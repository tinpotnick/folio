/**
 * <folio-doc>: the embeddable document component (ADR-0006).
 * One contenteditable surface for the whole document (seamless
 * WYSIWYG); the model is synced from the DOM, never the reverse
 * during typing. Full re-render happens only on structural ops.
 * Row/column operations live in a context menu, not on the page.
 */
import {
  parseDoc,
  serializeDoc,
  type Doc,
  type DocBlock,
} from "@folio/engine/doc";
import { outlineOf, type OutlineEntry } from "@folio/engine/outline";
import { recalcTable, type TablePool } from "@folio/engine/recalc";
import type { Audio, Cell, Chart, Image, Table } from "@folio/engine/index.js";
import { executeQuery, filterIndexes, sortIndexes } from "@folio/engine/query";
import type { StrudelRepl } from "@strudel/web";
import { CODE_LANGUAGES, paintCode, tokenizeCode } from "./render/code.js";
import { DRUM_KIT, drumKitUrls } from "./audio/drum-kit.js";
import { themeFromDoc, themeCss, type Mode } from "./render/theme.js";
import { registerFonts } from "./render/fonts.js";
import {
  renderAreaChart,
  renderBarChart,
  renderLineChart,
  renderPieChart,
  renderScatterChart,
  type ChartStyle,
} from "./render/chart.js";
import { inlineMarkdownToHtml, htmlToInlineMarkdown } from "./render/inline.js";

type CodeBlock = Extract<DocBlock, { kind: "code" }>;

/** A strudel block's playing highlight (spec: strudel-blocks.md). */
interface StrudelPlaying {
  figure: HTMLElement;
  code: HTMLElement;
  /** The source the atom spans were painted for. */
  source: string;
  /** Atom spans by "start:end" source range. */
  marks: Map<string, HTMLElement>;
  lit: Set<HTMLElement>;
  raf: number | null;
}

/**
 * WebKitGTK (the Linux desktop webview) reports an AudioContext
 * destination's maxChannelCount as 0 and rejects EVERY channelCount
 * assignment against that limit. Strudel sizes its output with
 * destination.channelCount = maxChannelCount, which then throws on
 * every note - a running clock, no sound. Patch the PROTOTYPE, not
 * the instance: WebKit may collect the destination's JS wrapper and
 * hand out a fresh one, dropping instance properties (a long tune
 * lost the fix mid-play). Both overrides only act where the engine
 * itself reports 0: maxChannelCount then reports the channel count
 * the destination actually has, and a refused assignment keeps it.
 */
let zeroChannelPatched = false;
function patchZeroChannelDestinations(): void {
  if (zeroChannelPatched) return;
  zeroChannelPatched = true;
  const proto = AudioDestinationNode.prototype;
  const max = Object.getOwnPropertyDescriptor(proto, "maxChannelCount");
  const cc =
    Object.getOwnPropertyDescriptor(proto, "channelCount") ??
    Object.getOwnPropertyDescriptor(AudioNode.prototype, "channelCount");
  const readMax = max?.get;
  const readCount = cc?.get;
  const writeCount = cc?.set;
  if (!readMax || !readCount || !writeCount) return;
  Object.defineProperty(proto, "maxChannelCount", {
    configurable: true,
    enumerable: true,
    get(this: AudioDestinationNode): number {
      const n = readMax.call(this) as number;
      return n >= 1 ? n : Math.max(readCount.call(this) as number, 2);
    },
  });
  Object.defineProperty(proto, "channelCount", {
    configurable: true,
    enumerable: true,
    get(this: AudioDestinationNode): number {
      return readCount.call(this) as number;
    },
    set(this: AudioDestinationNode, v: number) {
      try {
        writeCount.call(this, v);
      } catch (e) {
        // Only the zero-limit quirk is absorbed; real errors stand.
        if ((readMax.call(this) as number) >= 1) throw e;
      }
    },
  });
}

const PLAY_LABEL = "▶ Play";
const PLAYING_LABEL = "▶ Playing…";
const UPDATE_LABEL = "▶ Update";

/**
 * A structural deep clone for undo snapshots: objects and arrays
 * are rebuilt node by node, but STRINGS are shared (immutable in
 * JS) - a document full of audio data URIs snapshots for the cost
 * of its block structure, never its media bytes.
 */
function cloneBlocks(blocks: DocBlock[]): DocBlock[] {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>)) {
        out[k] = walk((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return blocks.map((b) => walk(b) as DocBlock);
}

/** Undo grouping: same-label changes within this window are one step. */
const COALESCE_MS = 600;
/** Two changes this close are one user action, whatever their labels. */
const ACTION_MS = 100;
/** The undo stack's ceiling. */
const HISTORY_MAX = 100;

export class FolioDoc extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["src", "mode"];
  }

  private doc: Doc | null = null;
  private listeners: ((doc: Doc) => void)[] = [];
  private menu: HTMLElement | null = null;
  private lastCell: HTMLTableCellElement | null = null;
  private lastHeaderName: HTMLElement | null = null;
  /** The dataset browser overlay (a singleton in the shadow root). */
  private dsBrowser: HTMLElement | null = null;
  private dsState: {
    filter: string;
    sortBy: string | null;
    sortDir: "asc" | "desc";
  } = { filter: "", sortBy: null, sortDir: "asc" };
  private lastBlock: HTMLElement | null = null;
  /**
   * The last mouse-drag text selection, built from the two caret
   * points (document.caretRangeFromPoint pierces the shadow tree
   * in every engine). WebKitGTK exposes no selection API that
   * pierces the shadow root, so without this the inline format
   * buttons could not resolve any selection there at all.
   */
  private dragRange: Range | null = null;
  private dragStart: { x: number; y: number } | null = null;
  /** The live strudel REPL, once initStrudel has resolved. */
  private repl: StrudelRepl | null = null;
  /**
   * The AudioContext created SYNCHRONOUSLY in the play click
   * (ADR-0014): WebKit's autoplay policy only lets a context run
   * when it is created and resumed inside the user gesture. The
   * strudel import is a heavy async boundary - a context created
   * after it stays suspended and play does nothing (the bug this
   * field exists to prevent).
   */
  private strudelCtx: AudioContext | null = null;
  /** The one strudel REPL's setup, started by the first play. */
  private strudelInit: Promise<StrudelRepl> | null = null;
  /** Receives the REPL's evaluation error for the play in flight. */
  private strudelEvalError: ((e: unknown) => void) | null = null;
  /** The playing highlight, while a strudel block plays. */
  private strudelPlaying: StrudelPlaying | null = null;
  /** The text each code figure's syntax colors were painted for. */
  private painted = new WeakMap<HTMLElement, string>();
  /**
   * Undo/redo (spec: docs/specs/undo-redo.md): snapshots of the
   * block list, taken at the `emitChange` chokepoint. Strings are
   * shared (immutable), so data URIs never get copied per
   * snapshot; consecutive same-label changes within the coalesce
   * window merge into one step (a typing burst is one undo).
   */
  private undoStack: DocBlock[][] = [];
  private redoStack: DocBlock[][] = [];
  /** The blocks as of the last change - the NEXT group's pre-state. */
  private committed: DocBlock[] | null = null;
  private activeLabel: string | null = null;
  private lastChangeAt = 0;
  /** Restores re-render and re-emit; they must not become history. */
  private restoring = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleCellBlur = this.handleCellBlur.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  connectedCallback(): void {
    // The themes' typefaces ship with the component (ADR-0017);
    // @font-face only works on the host document, not in a shadow
    // root.
    registerFonts(this.ownerDocument);
    this.load(this.getAttribute("src") ?? "");
  }

  attributeChangedCallback(name: string, old: string, value: string): void {
    if (name === "src" && old !== value && this.shadowRoot?.childNodes.length) {
      this.load(value);
    }
    if (name === "mode" && old !== value) this.restyle();
  }

  /**
   * Load a document. History semantics (spec: undo-redo.md): a
   * DIFFERENT document (open, example, followed link) starts the
   * history fresh; the same bytes (a view round-trip) keep it;
   * `keepHistory` turns a model-level change made outside the
   * article (settings apply, markdown-view edits) into ONE undo
   * step instead of a reset.
   */
  async load(src: string, opts?: { keepHistory?: boolean }): Promise<void> {
    if (!src.trim()) {
      this.renderEmpty();
      return;
    }
    try {
      let text: string;
      if (src.includes("\n")) {
        text = src;
      } else {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
        text = await res.text();
      }
      const parsed = parseDoc(text);
      const same =
        this.doc !== null && serializeDoc(this.doc) === serializeDoc(parsed);
      this.doc = parsed;
      // A new document invalidates any open dataset browser.
      this.closeDataset();
      if (same) {
        this.render();
      } else if (opts?.keepHistory) {
        this.render();
        this.noteHistory("load");
      } else {
        this.clearHistory();
        this.render();
      }
    } catch (e) {
      this.renderError(e instanceof Error ? e.message : String(e));
    }
  }

  getDoc(): Doc | null {
    return this.doc;
  }

  getOutline(): OutlineEntry[] {
    return this.doc ? outlineOf(this.doc) : [];
  }

  revealBlock(blockIndex: number): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const el = host?.children[blockIndex] as HTMLElement | undefined;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  firstVisibleBlockIndex(): number {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return -1;
    const hostRect = this.getBoundingClientRect();
    const top = hostRect.top;
    for (let i = 0; i < host.children.length; i++) {
      const el = host.children[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 8) return i;
    }
    return host.children.length - 1;
  }

  getMarkdown(): string | null {
    return this.doc ? serializeDoc(this.doc) : null;
  }

  onChange(fn: (doc: Doc) => void): void {
    this.listeners.push(fn);
  }

  private emitChange(label = "edit"): void {
    if (!this.doc) return;
    this.noteHistory(label);
    for (const fn of this.listeners) fn(this.doc);
  }

  /**
   * Record a change against the undo history. Changes group into
   * undo steps: the same label within COALESCE_MS (a typing
   * burst) or anything within ACTION_MS (the several emits of
   * one user action - a keystroke commits a cell AND syncs the
   * article) merges; a new group pushes the last committed state
   * as that step's pre-image and clears redo.
   */
  private noteHistory(label: string): void {
    if (!this.doc || this.restoring) return;
    const now = Date.now();
    const same =
      (label === this.activeLabel && now - this.lastChangeAt < COALESCE_MS) ||
      now - this.lastChangeAt < ACTION_MS;
    if (this.committed === null) {
      this.committed = cloneBlocks(this.doc.blocks);
      this.activeLabel = label;
      this.lastChangeAt = now;
      this.dispatchHistory();
      return;
    }
    if (!same) {
      this.undoStack.push(this.committed);
      if (this.undoStack.length > HISTORY_MAX) this.undoStack.shift();
      this.redoStack = [];
      this.activeLabel = label;
    }
    this.committed = cloneBlocks(this.doc.blocks);
    this.lastChangeAt = now;
    this.dispatchHistory();
  }

  private clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.activeLabel = null;
    this.lastChangeAt = 0;
    this.committed = this.doc ? cloneBlocks(this.doc.blocks) : null;
    this.dispatchHistory();
  }

  /** The host mirrors canUndo/canRedo onto its toolbar buttons. */
  private dispatchHistory(): void {
    this.dispatchEvent(
      new CustomEvent("folio-history", {
        detail: { canUndo: this.canUndo(), canRedo: this.canRedo() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Step back to the pre-image of the current change group. The
   * restore re-renders and re-emits, but never re-enters history.
   */
  undo(): boolean {
    if (!this.doc || this.undoStack.length === 0) return false;
    const caretIdx = this.blockIndexAtCaret();
    const snapshot = this.undoStack.pop() as DocBlock[];
    this.redoStack.push(cloneBlocks(this.doc.blocks));
    this.doc = { ...this.doc, blocks: cloneBlocks(snapshot) };
    this.committed = cloneBlocks(this.doc.blocks);
    this.activeLabel = null;
    this.lastChangeAt = 0;
    this.restoring = true;
    try {
      this.closeDataset();
      this.render();
      this.emitChange();
    } finally {
      this.restoring = false;
    }
    // The restore's render replaced the article; without this
    // a follow-up keystroke (a second Ctrl+Z) goes nowhere.
    const last = (this.doc?.blocks.length ?? 1) - 1;
    this.focusBlockStart(Math.max(0, Math.min(caretIdx, last)), true);
    this.dispatchHistory();
    return true;
  }

  /** Step forward again, mirroring undo(). */
  redo(): boolean {
    if (!this.doc || this.redoStack.length === 0) return false;
    const caretIdx = this.blockIndexAtCaret();
    const snapshot = this.redoStack.pop() as DocBlock[];
    this.undoStack.push(cloneBlocks(this.doc.blocks));
    this.doc = { ...this.doc, blocks: cloneBlocks(snapshot) };
    this.committed = cloneBlocks(this.doc.blocks);
    this.activeLabel = null;
    this.lastChangeAt = 0;
    this.restoring = true;
    try {
      this.closeDataset();
      this.render();
      this.emitChange();
    } finally {
      this.restoring = false;
    }
    // The restore's render replaced the article; without this
    // a follow-up keystroke (a second Ctrl+Z) goes nowhere.
    const last = (this.doc?.blocks.length ?? 1) - 1;
    this.focusBlockStart(Math.max(0, Math.min(caretIdx, last)), true);
    this.dispatchHistory();
    return true;
  }

  private renderEmpty(): void {
    const root = this.shadowRoot;
    if (root) {
      root.innerHTML =
        "<style>:host{display:block;font-family:system-ui;padding:1em;color:#57606a}</style><p>No document loaded — set the <code>src</code> attribute to a Markdown file path or inline document text.</p>";
    }
  }

  private renderError(message: string): void {
    const root = this.shadowRoot;
    if (root) {
      root.innerHTML =
        "<style>:host{display:block;font-family:system-ui;padding:1em;color:#862e2e}</style><p>Could not load document: " +
        message.replace(
          /[<>&]/g,
          (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
        ) +
        "</p>";
    }
  }

  private render(): void {
    if (!this.doc || !this.shadowRoot) return;
    // A full render replaces every figure: music stops with it
    // (only once the library was ever loaded - never import it
    // for a document that plays nothing).
    if (this.repl !== null) void this.stopStrudel();
    const theme = themeFromDoc(this.doc);
    const root = this.shadowRoot;
    root.innerHTML = "";
    const style = document.createElement("style");
    style.id = "folio-theme";
    style.textContent = themeCss(theme, this.mode());
    root.appendChild(style);

    const host = document.createElement("article");
    host.className = "folio-doc";
    host.setAttribute("contenteditable", "true");
    host.spellcheck = true;
    host.addEventListener("keydown", this.handleKeydown);
    // Clicking a link FOLLOWS it - never places the caret for
    // editing. The host hears the composed event and opens the
    // target (document links load in place; external URLs open in
    // a new tab). Editing lives on the toolbar's link button.
    host.addEventListener("click", (ev) => {
      const a = (ev.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!a) return;
      ev.preventDefault();
      this.dispatchEvent(
        new CustomEvent("folio-link", {
          detail: { href: a.getAttribute("href") ?? "" },
          bubbles: true,
          composed: true,
        }),
      );
    });
    host.addEventListener(
      "mousedown",
      (ev: MouseEvent) => {
        this.dragStart = { x: ev.clientX, y: ev.clientY };
        const el = this.shadowRoot?.elementFromPoint(ev.clientX, ev.clientY);
        const block = el?.closest("[data-block-index]") as HTMLElement | null;
        if (block) this.lastBlock = block;
        // One inspector contract for every figure (spec: docs/
        // specs/figure-inspectors.md): bars reveal on a click
        // inside their figure and hide on any click outside it -
        // the table inspector's behavior. No close buttons: they
        // were an inconsistent second way to dismiss.
        const hitFigure = el?.closest("figure") as HTMLElement | null;
        for (const bar of Array.from(
          this.shadowRoot?.querySelectorAll<HTMLElement>(
            ".folio-inspector:not([hidden])",
          ) ?? [],
        )) {
          const owner = bar.closest("figure");
          if (owner === hitFigure) continue;
          bar.hidden = true;
          // Leaving a code block: repaint its syntax colors for
          // the edited text (never while the caret is inside).
          if (owner?.classList.contains("folio-codeblock")) {
            void this.highlightCode(owner as HTMLElement);
          }
        }
      },
      true,
    );
    host.addEventListener(
      "mouseup",
      (ev: MouseEvent) => {
        const start = this.dragStart;
        this.dragStart = null;
        if (!start) return;
        if (ev.detail >= 2) {
          // Double/triple click: the browser selected a word (or
          // line) natively; no drag ran, so mirror the word.
          this.dragRange = this.wordRangeAt(ev.clientX, ev.clientY);
          return;
        }
        this.dragRange = this.rangeBetweenPoints(
          start.x,
          start.y,
          ev.clientX,
          ev.clientY,
        );
      },
      true,
    );
    host.addEventListener("input", this.handleInput);
    host.addEventListener("contextmenu", this.handleContextMenu);

    this.doc.blocks.forEach((block, idx) => {
      host.appendChild(this.renderBlock(block, idx));
    });
    root.appendChild(host);
  }

  private renderBlock(block: Doc["blocks"][number], idx: number): HTMLElement {
    switch (block.kind) {
      case "heading": {
        const el = document.createElement(
          `h${String(Math.min(block.level, 6))}`,
        );
        el.dataset.blockIndex = String(idx);
        el.textContent = block.text;
        return el;
      }
      case "prose": {
        const el = document.createElement("p");
        el.dataset.blockIndex = String(idx);
        el.innerHTML = inlineMarkdownToHtml(block.text);
        return el;
      }
      case "code": {
        return this.renderCode(block, idx);
      }
      case "table": {
        return this.renderTable(block, idx);
      }
      case "diagram": {
        const figure = document.createElement("figure");
        figure.className = "folio-diagram";
        figure.dataset.blockIndex = String(idx);
        figure.dataset.diagramId = block.diagram.id;
        // Diagrams are generated output, not editable prose, but
        // they are selectable (tabindex) so Backspace/Delete on a
        // selected diagram removes the block.
        figure.contentEditable = "false";
        figure.tabIndex = -1;
        figure.title = "Diagram - Backspace or Delete removes it";
        figure.appendChild(this.buildTextInspector(figure, idx, "diagram"));
        const holder = document.createElement("div");
        holder.className = "diagram-holder";
        holder.textContent = block.diagram.text;
        figure.appendChild(holder);
        this.drawDiagram(figure);
        return figure;
      }
      case "math": {
        const figure = document.createElement("figure");
        figure.className = "folio-math";
        figure.dataset.blockIndex = String(idx);
        figure.contentEditable = "false";
        figure.appendChild(this.buildTextInspector(figure, idx, "math"));
        const holder = document.createElement("div");
        holder.className = "math-holder";
        figure.appendChild(holder);
        void this.drawMath(figure);
        return figure;
      }
      case "image": {
        return this.renderImage(block, idx);
      }
      case "audio": {
        return this.renderAudio(block, idx);
      }
      case "chart": {
        const figure = document.createElement("figure");
        figure.dataset.blockIndex = String(idx);
        figure.dataset.chartSource = block.chart.source;
        // Generated output: the SVG and caption never swallow
        // typed text; the inspector inputs are their own region.
        figure.contentEditable = "false";
        figure.appendChild(this.buildChartInspector(figure, block));
        const holder = document.createElement("div");
        holder.className = "chart-holder";
        figure.appendChild(holder);
        if (block.chart.caption) {
          const cap = document.createElement("figcaption");
          cap.textContent = block.chart.caption;
          figure.appendChild(cap);
        }
        this.drawChart(figure);
        return figure;
      }
      default: {
        const el = document.createElement("p");
        el.dataset.blockIndex = String(idx);
        return el;
      }
    }
  }

  /**
   * A fenced code block (spec: docs/specs/code-blocks.md): a figure
   * holding the code header - an inspector bar with the language
   * picker plus per-language controls (strudel's player, spec:
   * docs/specs/strudel-blocks.md) - and the code body. Unlike the
   * generated figures, the body edits in place like prose, and is
   * syntax-highlighted for supported languages (presentation only;
   * the model reads the body's text back).
   */
  private renderCode(block: CodeBlock, idx: number): HTMLElement {
    const strudel = block.lang === "strudel";
    const figure = document.createElement("figure");
    figure.className = strudel
      ? "folio-codeblock folio-strudel"
      : "folio-codeblock";
    figure.dataset.blockIndex = String(idx);
    if (block.lang !== undefined) figure.dataset.lang = block.lang;
    figure.appendChild(this.buildCodeInspector(figure, block));
    const pre = document.createElement("pre");
    pre.className = strudel ? "folio-code strudel-source" : "folio-code";
    if (block.lang !== undefined) pre.dataset.lang = block.lang;
    const code = document.createElement("code");
    code.textContent = block.text;
    pre.appendChild(code);
    figure.appendChild(pre);
    void this.highlightCode(figure);
    return figure;
  }

  /** The code body's current text (rendered line breaks included). */
  private codeText(code: HTMLElement): string {
    return code.isConnected ? code.innerText : (code.textContent ?? "");
  }

  /**
   * (Re)paint a code figure's syntax colors. Skipped when the text
   * already painted is current, when the body was edited while the
   * grammar loaded, or while strudel playback owns the paint.
   * Repainting moves no caret only because it runs on render and
   * when the user leaves the block (the header hides).
   */
  private async highlightCode(figure: HTMLElement): Promise<void> {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    if (!code) return;
    const text = this.codeText(code);
    if (this.painted.get(figure) === text) return;
    const tokens = await tokenizeCode(text, figure.dataset.lang);
    if (tokens === null) return;
    if (code.isConnected && this.codeText(code) !== text) return;
    if (this.strudelPlaying?.figure === figure) return;
    paintCode(code, text, tokens);
    this.painted.set(figure, text);
  }

  /**
   * The code header (spec: docs/specs/code-blocks.md): one bar for
   * every language - the language picker - plus the controls that
   * language adds (strudel: play / stop / error line). It follows
   * the ONE inspector contract (docs/specs/figure-inspectors.md):
   * reveal on a click inside the figure, hide on a click outside,
   * Esc dismisses early, no close button.
   */
  private buildCodeInspector(
    figure: HTMLElement,
    block: CodeBlock,
  ): HTMLElement {
    const bar = this.figureBar();
    bar.classList.add("code-inspector");
    const picker = document.createElement("select");
    picker.className = "code-lang";
    picker.title = "Code language";
    picker.setAttribute("aria-label", "Code language");
    const options: Array<[string, string]> = [
      ["", "Plain text"],
      ...CODE_LANGUAGES.map((l): [string, string] => [l.id, l.label]),
    ];
    // An unlisted fence tag stays selectable as itself, so opening
    // the header never rewrites a language it does not know.
    if (
      block.lang !== undefined &&
      !CODE_LANGUAGES.some((l) => l.id === block.lang)
    ) {
      options.push([block.lang, block.lang]);
    }
    for (const [value, label] of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      picker.appendChild(opt);
    }
    picker.value = block.lang ?? "";
    picker.addEventListener("change", () => {
      this.setCodeLanguage(
        Number(figure.dataset.blockIndex ?? -1),
        picker.value,
      );
    });
    bar.appendChild(picker);
    if (block.lang === "strudel") {
      bar.append(...this.buildStrudelControls(figure));
    }
    figure.addEventListener("mousedown", () => {
      bar.hidden = false;
    });
    return bar;
  }

  /**
   * Change a code block's language from its header: a model write
   * that re-renders the one figure in place (the header stays open
   * on the picker) and reaches the fence tag in the source.
   */
  setCodeLanguage(idx: number, lang: string): void {
    const block = this.doc?.blocks[idx];
    if (!block || block.kind !== "code") return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const old = host?.children[idx] as HTMLElement | undefined;
    if (this.strudelPlaying && this.strudelPlaying.figure === old) {
      void this.stopStrudel();
    }
    if (lang === "") delete block.lang;
    else block.lang = lang;
    const fresh = this.renderBlock(block, idx);
    if (old) old.replaceWith(fresh);
    const bar = fresh.querySelector<HTMLElement>(".folio-inspector");
    if (bar) bar.hidden = false;
    fresh.querySelector<HTMLElement>("select.code-lang")?.focus();
    this.emitChange();
  }

  /**
   * Backspace in an EMPTY code body removes the block (its header
   * would otherwise strand an empty figure); the caret moves to the
   * end of the previous block. True when a block was removed.
   */
  private removeEmptyCodeBlock(): boolean {
    if (!this.doc) return false;
    const idx = this.blockIndexAtCaret();
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const figure = host?.children[idx] as HTMLElement | undefined;
    if (!figure?.classList.contains("folio-codeblock")) return false;
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    if (!code || (code.textContent ?? "") !== "") return false;
    this.doc.blocks.splice(idx, 1);
    this.render();
    this.emitChange("delete");
    if (idx > 0) this.focusBlockStart(idx - 1, true);
    return true;
  }

  /**
   * Reveal the caret's code header with the language picker
   * focused - the palette's "Change the code block language".
   * False when the caret is not in a code block.
   */
  focusCodeLanguage(): boolean {
    const idx = this.blockIndexAtCaret();
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const figure = host?.children[idx] as HTMLElement | undefined;
    if (!figure?.classList.contains("folio-codeblock")) return false;
    for (const other of Array.from(
      host?.querySelectorAll<HTMLElement>(".folio-inspector") ?? [],
    )) {
      if (other.closest("figure") !== figure) other.hidden = true;
    }
    const bar = figure.querySelector<HTMLElement>(".folio-inspector");
    if (bar) bar.hidden = false;
    figure.querySelector<HTMLElement>("select.code-lang")?.focus();
    return true;
  }

  /**
   * The strudel player controls of the code header: play / stop and
   * the error line. The library is loaded lazily on the first play
   * (ADR-0014) - bundled, never fetched; the click is the autoplay
   * gesture. Play while playing re-evaluates the (edited) source.
   */
  private buildStrudelControls(figure: HTMLElement): HTMLElement[] {
    const err = document.createElement("span");
    err.className = "insp-error strudel-error";
    err.hidden = true;
    const play = document.createElement("button");
    play.type = "button";
    play.className = "insp-select strudel-play";
    play.textContent = PLAY_LABEL;
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "insp-select strudel-stop";
    stop.textContent = "■ Stop";
    play.addEventListener("click", () => {
      const code = figure.querySelector<HTMLElement>(
        "pre.strudel-source > code",
      );
      if (!code) return;
      err.hidden = true;
      // Unlock audio SYNCHRONOUSLY, inside the gesture, BEFORE
      // the async import - the load must never eat the activation
      // window (the play-does-nothing bug on WebKitGTK).
      this.ensureStrudelAudio();
      play.textContent = PLAYING_LABEL;
      void this.playStrudel(figure, this.codeText(code), err, play);
    });
    stop.addEventListener("click", () => {
      err.hidden = true;
      void this.stopStrudel();
    });
    return [play, stop, err];
  }

  /**
   * Create (once) and resume the AudioContext inside the click's
   * user-gesture window. Falls back to strudel's own context when
   * the engine has no audio.
   */
  private ensureStrudelAudio(): void {
    if (this.strudelCtx === null) {
      try {
        const Ctor =
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (Ctor) this.strudelCtx = new Ctor();
      } catch {
        this.strudelCtx = null;
      }
      const dest = this.strudelCtx?.destination;
      if (dest && dest.maxChannelCount < 1) patchZeroChannelDestinations();
    }
    if (this.strudelCtx !== null) void this.strudelCtx.resume();
  }

  /**
   * Start (or re-evaluate) strudel playback for one block's source.
   * The library is dynamically imported on first use only (the
   * Mermaid/KaTeX pattern, ADR-0010/0011) and initialised ONCE - a
   * second REPL would keep the first one's pattern playing past
   * Stop. Evaluation errors surface as content in the header's
   * error line, never a broken render.
   */
  private async playStrudel(
    figure: HTMLElement,
    source: string,
    err: HTMLElement,
    play: HTMLElement,
  ): Promise<void> {
    try {
      const strudel = await import("@strudel/web");
      this.strudelInit ??= strudel
        .initStrudel({
          // The pre-unlocked context: created and resumed in the
          // click, so the clock starts even on strict engines.
          audioContext: this.strudelCtx ?? undefined,
          // The REPL logs evaluation errors instead of rejecting;
          // route them to the block being played.
          onEvalError: (e) => this.strudelEvalError?.(e),
          // folio's bundled CC0 drum kit (ADR-0016): registered
          // under the standard names and PRELOADED - strudel loads
          // samples lazily and skips a hit whose buffer arrives
          // late, so a cold kit would drop the first beats. A
          // sample that fails to load stays silent, never fatal.
          prebake: async () => {
            await strudel.samples(DRUM_KIT);
            const ctx = strudel.getAudioContext();
            await Promise.all(
              drumKitUrls().map((url) =>
                strudel.loadBuffer(url, ctx).catch(() => null),
              ),
            );
          },
        })
        .catch((e: unknown) => {
          this.strudelInit = null;
          throw e;
        });
      const repl = await this.strudelInit;
      this.repl = repl;
      const status: { error: unknown } = { error: null };
      this.strudelEvalError = (e) => {
        status.error = e ?? new Error("the pattern did not evaluate");
      };
      try {
        await strudel.evaluate(source);
      } finally {
        this.strudelEvalError = null;
      }
      if (status.error !== null) throw status.error;
      await this.startStrudelLights(figure, source, repl);
      // Audio watchdog: if folio's context never starts running
      // (an engine that cannot open an audio device), say so
      // instead of leaving a silent "Playing..." label up.
      const audible = await this.waitStrudelAudio(2000);
      if (!audible) {
        await this.stopStrudel();
        if (err.isConnected) {
          err.textContent =
            "Audio device unavailable - no sound output. Check the " +
            "system's audio output and press Play again.";
          err.hidden = false;
        }
      }
    } catch (e) {
      if (play.isConnected) play.textContent = PLAY_LABEL;
      if (err.isConnected) {
        err.textContent = `Strudel error: ${
          e instanceof Error ? e.message : String(e)
        }`;
        err.hidden = false;
      }
    }
  }

  /**
   * The playing highlight (spec: docs/specs/strudel-blocks.md):
   * the strudel REPL's own technique. The evaluator reports every
   * mini-notation atom's source range up front (miniLocations), so
   * the body is painted once with an addressable span per atom;
   * then every animation frame queries the playing pattern at the
   * scheduler's current cycle and lights the atoms of every hap
   * sounding NOW - all of each hap's source locations, for the
   * hap's whole duration. Lit atoms fade out via CSS when released.
   */
  private async startStrudelLights(
    figure: HTMLElement,
    source: string,
    repl: StrudelRepl,
  ): Promise<void> {
    this.stopStrudelLights();
    const code = figure.querySelector<HTMLElement>("pre.strudel-source > code");
    if (!code) return;
    const tokens = (await tokenizeCode(source, "strudel")) ?? [];
    if (!code.isConnected || this.codeText(code) !== source) return;
    this.stopStrudelLights();
    const marks = paintCode(code, source, tokens, repl.state.miniLocations);
    this.painted.set(figure, source);
    const state: StrudelPlaying = {
      figure,
      code,
      source,
      marks,
      lit: new Set(),
      raf: null,
    };
    this.strudelPlaying = state;
    const tick = (): void => {
      if (this.strudelPlaying !== state) return;
      if (!code.isConnected) {
        this.strudelPlaying = null;
        return;
      }
      const on = new Set<HTMLElement>();
      try {
        const t = repl.scheduler.now();
        const haps = repl.state.pattern?.queryArc(t, t + 1 / 240) ?? [];
        for (const hap of haps) {
          const whole = hap.whole;
          if (!whole || Number(whole.begin) > t || Number(whole.end) <= t) {
            continue;
          }
          for (const loc of hap.context?.locations ?? []) {
            const el = marks.get(`${loc.start}:${loc.end}`);
            if (el) on.add(el);
          }
        }
      } catch {
        // A query error leaves the lights as they were.
      }
      for (const el of state.lit) {
        if (!on.has(el)) el.classList.remove("strudel-on");
      }
      for (const el of on) {
        if (!state.lit.has(el)) el.classList.add("strudel-on");
      }
      state.lit = on;
      state.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  /**
   * Stop the playing highlight: lights out, the atom spans give
   * way to plain syntax colors, and the block's Play button reads
   * Play again. Audio is untouched (stopStrudel hushes).
   */
  private stopStrudelLights(): void {
    const state = this.strudelPlaying;
    if (!state) return;
    this.strudelPlaying = null;
    if (state.raf !== null) cancelAnimationFrame(state.raf);
    for (const el of state.lit) el.classList.remove("strudel-on");
    const play = state.figure.querySelector<HTMLElement>(".strudel-play");
    if (play) play.textContent = PLAY_LABEL;
    this.painted.delete(state.figure);
    void this.highlightCode(state.figure);
  }

  /**
   * The playing block's source was edited: the atom ranges no
   * longer match the text, so the lights stop (the audio plays on)
   * and Play offers to apply the edit.
   */
  private freezeStrudelLights(): void {
    const state = this.strudelPlaying;
    if (!state || !state.code.isConnected) return;
    if (this.codeText(state.code) === state.source) return;
    this.strudelPlaying = null;
    if (state.raf !== null) cancelAnimationFrame(state.raf);
    for (const el of state.lit) el.classList.remove("strudel-on");
    const play = state.figure.querySelector<HTMLElement>(".strudel-play");
    if (play) play.textContent = UPDATE_LABEL;
  }

  /**
   * Whether folio's AudioContext reached "running" within the
   * window. False means the engine could not start audio output
   * (its context stayed suspended or "interrupted"); the play can
   * at best be visual and the user must be told.
   */
  private async waitStrudelAudio(timeoutMs: number): Promise<boolean> {
    const ctx = this.strudelCtx;
    if (ctx === null) return true; // strudel's own context
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (ctx.state === "running") return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return ctx.state === "running";
  }

  /**
   * Stop all strudel playback. Hush is safe to call whether or
   * not the library ever loaded.
   */
  private async stopStrudel(): Promise<void> {
    this.stopStrudelLights();
    for (const play of Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>(".strudel-play") ?? [],
    )) {
      play.textContent = PLAY_LABEL;
    }
    const strudel = await import("@strudel/web").catch(() => null);
    if (strudel) strudel.hush();
  }

  /**
   * Insert a starter strudel block after the caret's block (the
   * toolbar's music button).
   */
  insertStrudel(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(at, 0, {
      kind: "code",
      lang: "strudel",
      text: 'note("c a f e")',
    });
    this.render();
    this.emitChange();
  }

  /**
   * The document's tables by id, for cross-table formula
   * references (budget.r3.q2): a table's formulas may read any
   * other table of the same document.
   */
  private tablePool(): TablePool {
    const blocks = this.doc?.blocks ?? [];
    return (id: string): Table | undefined => {
      for (const b of blocks) {
        if (b.kind === "table" && b.table.id === id) return b.table;
      }
      return undefined;
    };
  }

  private renderTable(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    idx: number,
  ): HTMLElement {
    const figure = document.createElement("figure");
    figure.dataset.blockIndex = String(idx);
    figure.dataset.tableId = block.table.id;
    const inspector = this.buildInspector(figure, block);
    figure.appendChild(inspector);
    // A broken formula (a rename that orphaned a reference, bad
    // Jexl) must not take the whole render down: the error shows in
    // place, and the inspector stays up so it can be fixed from the
    // document view.
    let recalced: Table;
    try {
      recalced = recalcTable(block.table, this.tablePool());
    } catch (e) {
      const err = document.createElement("div");
      err.className = "folio-table-error";
      err.textContent = `Table error: ${
        e instanceof Error ? e.message : String(e)
      }`;
      figure.appendChild(err);
      return figure;
    }
    const table = document.createElement("table");
    table.className = "folio-table";
    // Only data cells edit (they set contenteditable themselves):
    // the header, rows, and caption are generated output - typing
    // into them silently diverged from the model (the header was
    // editable by inheritance from the article).
    table.contentEditable = "false";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    block.table.columns.forEach((col, ci) => {
      const th = document.createElement("th");
      th.dataset.colIndex = String(ci);
      // Only the NAME is editable in place - the unit is a separate
      // read-only annotation. The in-place rename is the document-
      // view counterpart of editing the column name in the YAML.
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = col.name;
      name.contentEditable = "true";
      name.tabIndex = -1;
      // While the name is the edit target the th is all name: the
      // unit hides and the span fills the cell, so the rename
      // feels like editing any other cell instead of a sliver of
      // text bolted next to a read-only annotation.
      name.addEventListener("focus", () => th.classList.add("editing"));
      name.addEventListener("blur", () => {
        th.classList.remove("editing");
        this.commitHeaderRename(name, figure, block, ci);
      });
      th.appendChild(name);
      if (col.unit !== undefined) {
        th.title = col.unit;
        // Units are data, not decoration: the reader should see
        // "q2 (£k)" without hovering anything.
        const unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = ` (${col.unit})`;
        th.appendChild(unit);
      }
      if (col.type === "number" || col.type === "formula") {
        th.classList.add("num");
      }
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    // The viewport: a table longer than the theme's window shows
    // its head rows in flow. The model holds every row - charts,
    // formulas, and queries always see the full dataset - and the
    // status line opens the dataset browser for full-scale work.
    const rowsWindow = this.tableRowsWindow();
    const totalRows = recalced.rows.length;
    const shownRows = Math.min(totalRows, rowsWindow);
    recalced.rows.slice(0, shownRows).forEach((row, r) => {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = String(r);
      block.table.columns.forEach((col, c) => {
        const td = document.createElement("td");
        td.dataset.rowIndex = String(r);
        td.dataset.colIndex = String(c);
        const v = row[c];
        if (col.type === "formula") {
          td.classList.add("folio-formula");
          td.contentEditable = "false";
          td.textContent =
            col.format === "percent" && typeof v === "number"
              ? `${(v * 100).toFixed(1)}%`
              : String(v ?? "");
          if (typeof v === "number") td.classList.add("num");
        } else {
          if (col.type === "number") {
            td.classList.add("num");
          }
          td.textContent = String(v ?? "");
          // Nested editable, focusable leaf: the cell (not the
          // article) holds focus while it is edited, so blur-based
          // commits and Tab/Enter navigation are real. Without
          // tabindex the browser keeps focus on the article, cell
          // edits never commit, and Tab escapes to the host page
          // toolbar.
          td.contentEditable = "true";
          td.tabIndex = -1;
        }
        td.addEventListener("blur", this.handleCellBlur, true);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    // Browsers hand click focus to the article (the outer editing
    // host), so cell commits and Tab/Enter navigation would never see
    // a focused cell. Focus the clicked data cell ourselves: record
    // on mousedown, focus on mouseup, and restore the caret at the
    // click position (unless the mouse was dragged, which means the
    // user was selecting text - leave the selection alone).
    table.addEventListener("focusin", (ev) => {
      const cell = (ev.target as HTMLElement).closest(
        "td[data-row-index]",
      ) as HTMLTableCellElement | null;
      if (cell) this.lastCell = cell;
      const nameSpan = (ev.target as HTMLElement).closest(
        "thead th .name",
      ) as HTMLElement | null;
      if (nameSpan) this.lastHeaderName = nameSpan;
    });
    let cellClick: {
      cell: HTMLTableCellElement;
      x: number;
      y: number;
    } | null = null;
    table.addEventListener("mousedown", (ev) => {
      const cell = (ev.target as HTMLElement).closest(
        "td[data-row-index]",
      ) as HTMLTableCellElement | null;
      if (!cell) {
        // Clicking a column heading opens that column in the
        // inspector (its unit is a separate field there - the
        // heading itself is never edited in place).
        const th = (ev.target as HTMLElement).closest(
          "th[data-col-index]",
        ) as HTMLElement | null;
        if (th) {
          // The name is a nested editable: focus it on MOUSEDOWN,
          // before the inspector bar reveals and shifts the table
          // under the pointer (a mouseup-based focus lands on the
          // bar, never the table). The whole th is the name's
          // target - except the unit span, which opens the column
          // in the inspector and nothing more.
          const onUnit =
            (ev.target as HTMLElement).closest("thead th .unit") !== null;
          if (!onUnit) {
            // Cancel the native default: clicking a non-editable
            // region of the article hands focus to the article
            // (the editing host) AFTER our focus(), undoing it.
            ev.preventDefault();
            const nameSpan = th.querySelector(
              "span.name",
            ) as HTMLElement | null;
            if (nameSpan) {
              nameSpan.focus();
              const range = document.caretRangeFromPoint(
                ev.clientX,
                ev.clientY,
              );
              if (range && nameSpan.contains(range.startContainer)) {
                const sel = window.getSelection();
                sel?.setBaseAndExtent(
                  range.startContainer,
                  range.startOffset,
                  range.startContainer,
                  range.startOffset,
                );
              }
            }
          }
          this.showInspector(figure, block, Number(th.dataset.colIndex));
        }
        return;
      }
      // Any cell click focuses its column in the inspector bar -
      // formula cells especially: they are read-only in the table
      // but their expression is the bar's whole point.
      this.showInspector(figure, block, Number(cell.dataset.colIndex));
      if (cell.contentEditable === "true") {
        cellClick = { cell, x: ev.clientX, y: ev.clientY };
      }
    });
    table.addEventListener("mouseup", (ev) => {
      const pending = cellClick;
      cellClick = null;
      if (pending) {
        const dragged =
          Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) > 3;
        pending.cell.focus();
        if (!dragged) {
          const range = document.caretRangeFromPoint(pending.x, pending.y);
          if (range && pending.cell.contains(range.startContainer)) {
            const sel = window.getSelection();
            sel?.setBaseAndExtent(
              range.startContainer,
              range.startOffset,
              range.startContainer,
              range.startOffset,
            );
          }
        }
      }
    });
    figure.appendChild(table);
    if (shownRows < totalRows) {
      const more = document.createElement("div");
      more.className = "folio-table-more";
      more.contentEditable = "false";
      more.textContent = `${totalRows.toLocaleString()} rows × ${block.table.columns.length} columns — showing first ${shownRows}`;
      const open = document.createElement("button");
      open.className = "ds-open";
      open.type = "button";
      open.textContent = "Open dataset";
      open.addEventListener("mousedown", (ev) => {
        // The document must not steal focus before the overlay
        // opens (the insert-group buttons' rule).
        ev.preventDefault();
        ev.stopPropagation();
      });
      open.addEventListener("click", () => {
        this.openDataset(block.table.id);
      });
      more.appendChild(open);
      figure.appendChild(more);
    }
    if (block.table.caption) {
      const cap = document.createElement("figcaption");
      cap.contentEditable = "false";
      cap.textContent = block.table.caption;
      figure.appendChild(cap);
    }
    return figure;
  }

  /**
   * The table inspector (spec: docs/specs/table-inspector.md):
   * an Excel-style bar at the top of a table figure. Clicking a
   * cell shows the clicked column's properties - type, unit,
   * format, and for formula columns the expression (the ƒx field
   * Excel users look for) - all editable in place. Edits write to
   * the model and re-render the table; the document stays the
   * source of truth exactly as if the YAML was edited by hand.
   */
  private buildInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "folio-inspector";
    // A real editable region inside the contenteditable article
    // would swallow keystrokes; inputs here must own them.
    bar.contentEditable = "false";
    bar.hidden = true;
    // The shared inspector contract: Esc inside the bar dismisses
    // early; a click outside the figure dismisses otherwise.
    bar.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        bar.hidden = true;
      }
    });

    const colSel = document.createElement("select");
    colSel.className = "insp-col";
    colSel.addEventListener("change", () => {
      this.showInspector(figure, block, Math.max(colSel.selectedIndex, 0));
    });

    const typeSel = document.createElement("select");
    typeSel.className = "insp-type";
    typeSel.title = "Column type";
    for (const t of ["text", "number", "formula"]) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", () => {
      const type = typeSel.value as "text" | "number" | "formula";
      const c = Math.max(colSel.selectedIndex, 0);
      const patch: Record<string, unknown> = { type };
      // A formula column with an empty expression breaks recalc;
      // a fresh formula starts at a constant 0.
      if (type === "formula" && !block.table.columns[c]?.expr) {
        patch.expr = "0";
      }
      this.patchColumn(figure, block, c, patch);
    });

    const unitInp = document.createElement("input");
    unitInp.className = "insp-unit";
    unitInp.type = "text";
    unitInp.placeholder = "unit";
    unitInp.title = "Unit, shown in the column header";
    const unitPatch = (): void => {
      const c = Math.max(colSel.selectedIndex, 0);
      const v = unitInp.value.trim();
      this.patchColumn(figure, block, c, v ? { unit: v } : { unit: undefined });
    };
    unitInp.addEventListener("change", unitPatch);
    unitInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        unitPatch();
      }
    });

    const fmtSel = document.createElement("select");
    fmtSel.className = "insp-format";
    fmtSel.title = "Value format";
    const fmtNone = document.createElement("option");
    fmtNone.value = "default";
    fmtNone.textContent = "plain";
    fmtSel.appendChild(fmtNone);
    const fmtPct = document.createElement("option");
    fmtPct.value = "percent";
    fmtPct.textContent = "percent";
    fmtSel.appendChild(fmtPct);
    fmtSel.addEventListener("change", () => {
      const c = Math.max(colSel.selectedIndex, 0);
      this.patchColumn(figure, block, c, {
        format: fmtSel.value === "percent" ? "percent" : undefined,
      });
    });

    const fx = document.createElement("span");
    fx.className = "insp-fx";
    fx.textContent = "ƒx";

    const exprInp = document.createElement("input");
    exprInp.className = "insp-expr";
    exprInp.type = "text";
    exprInp.placeholder = "formula (Jexl)";
    const exprPatch = (): void => {
      const c = Math.max(colSel.selectedIndex, 0);
      const v = exprInp.value.trim();
      this.patchColumn(figure, block, c, { expr: v === "" ? "0" : v });
    };
    exprInp.addEventListener("change", exprPatch);
    exprInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        exprPatch();
      }
    });

    const capInp = document.createElement("input");
    capInp.className = "insp-caption";
    capInp.type = "text";
    capInp.placeholder = "caption";
    capInp.title = "Table caption (empty removes it)";
    const capPatch = (): void => {
      const v = capInp.value.trim();
      if (v) block.table.caption = v;
      else delete block.table.caption;
      const cap = figure.querySelector("figcaption");
      if (v && cap) cap.textContent = v;
      else if (v && !cap) {
        const el = document.createElement("figcaption");
        el.contentEditable = "false";
        el.textContent = v;
        figure.appendChild(el);
      } else if (!v && cap) {
        cap.remove();
      }
      this.emitChange();
    };
    capInp.addEventListener("change", capPatch);
    capInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        capPatch();
      }
    });

    const dsBtn = document.createElement("button");
    dsBtn.className = "insp-dataset";
    dsBtn.type = "button";
    dsBtn.title = "Open the dataset browser (all rows)";
    dsBtn.textContent = "▦";
    dsBtn.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    dsBtn.addEventListener("click", () => {
      this.openDataset(block.table.id);
    });
    bar.append(dsBtn, colSel, typeSel, unitInp, fmtSel, fx, exprInp, capInp);
    return bar;
  }

  /**
   * A figure inspector bar: shown by clicking its figure, hidden
   * by clicking elsewhere (the shared .folio-inspector hide logic
   * in the article's mousedown). All figure inspectors follow the
   * table inspector contract - edits are model writes that reach
   * the Markdown source; the figure re-renders in place.
   */
  private figureBar(): HTMLElement {
    const bar = document.createElement("div");
    // Same contract as the table inspector (spec: docs/specs/
    // figure-inspectors.md): reveal on a click inside the figure,
    // hide on any click outside it. Esc inside the bar dismisses
    // early - no close button, there is nothing else to click.
    bar.className = "folio-inspector figure-inspector";
    bar.contentEditable = "false";
    bar.hidden = true;
    bar.addEventListener("mousedown", (ev) => {
      // Clicks on the bar must not hide it (the figure check in
      // the article handler covers this, but keep the bar's own
      // clicks from reaching figure-level handlers).
      ev.stopPropagation();
    });
    bar.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        bar.hidden = true;
      }
    });
    return bar;
  }

  /**
   * The chart inspector (spec: docs/specs/figure-inspectors.md):
   * source table, type, selected columns, Jexl filter, sort, and
   * caption - the whole chart directive editable in the document
   * view. Apply redraws the chart in place.
   */
  private buildChartInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "chart" }>,
  ): HTMLElement {
    const bar = this.figureBar();
    const patch = (): void => {
      const chart = block.chart;
      chart.source = srcSel.value;
      chart.type = typeSel.value as Chart["type"];
      chart.query.select = selInp.value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      if (filterInp.value.trim() === "") delete chart.query.filter;
      else chart.query.filter = filterInp.value.trim();
      const by = sortInp.value.trim();
      if (by === "") delete chart.query.sort;
      else
        chart.query.sort = {
          by,
          order: orderSel.value === "desc" ? "desc" : "asc",
        };
      if (capInp.value.trim() === "") delete chart.caption;
      else chart.caption = capInp.value.trim();
      figure.dataset.chartSource = chart.source;
      const cap = figure.querySelector("figcaption");
      if (cap) cap.textContent = chart.caption ?? "";
      this.drawChart(figure);
      this.emitChange();
    };

    const srcSel = document.createElement("select");
    srcSel.className = "insp-source";
    srcSel.title = "Source table";
    for (const b of this.doc?.blocks ?? []) {
      if (b.kind !== "table") continue;
      const o = document.createElement("option");
      o.value = b.table.id;
      o.textContent = `@${b.table.id}`;
      srcSel.appendChild(o);
    }
    srcSel.addEventListener("change", patch);

    const typeSel = document.createElement("select");
    typeSel.className = "insp-type";
    typeSel.title = "Chart type";
    for (const t of [
      "bar",
      "line",
      "area",
      "pie",
      "donut",
      "scatter",
    ] as const) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", patch);

    const selInp = document.createElement("input");
    selInp.className = "insp-select";
    selInp.type = "text";
    selInp.placeholder = "select: col, col";
    const selPatch = (): void => patch();
    selInp.addEventListener("change", selPatch);
    selInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        selPatch();
      }
    });

    const filterInp = document.createElement("input");
    filterInp.className = "insp-filter";
    filterInp.type = "text";
    filterInp.placeholder = "filter: Jexl expression";
    const filterPatch = (): void => patch();
    filterInp.addEventListener("change", filterPatch);
    filterInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        filterPatch();
      }
    });

    const sortInp = document.createElement("input");
    sortInp.className = "insp-sort";
    sortInp.type = "text";
    sortInp.placeholder = "sort by";
    const sortPatch = (): void => patch();
    sortInp.addEventListener("change", sortPatch);
    sortInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        sortPatch();
      }
    });

    const orderSel = document.createElement("select");
    orderSel.className = "insp-order";
    for (const t of ["asc", "desc"] as const) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      orderSel.appendChild(o);
    }
    orderSel.addEventListener("change", patch);

    const capInp = document.createElement("input");
    capInp.className = "insp-caption";
    capInp.type = "text";
    capInp.placeholder = "caption";
    const capPatch = (): void => patch();
    capInp.addEventListener("change", capPatch);
    capInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        capPatch();
      }
    });

    const show = (): void => {
      srcSel.value = block.chart.source;
      typeSel.value = block.chart.type;
      selInp.value = block.chart.query.select.join(", ");
      filterInp.value =
        typeof block.chart.query.filter === "string"
          ? block.chart.query.filter
          : "";
      sortInp.value = block.chart.query.sort?.by ?? "";
      orderSel.value = block.chart.query.sort?.order ?? "asc";
      capInp.value = block.chart.caption ?? "";
      bar.hidden = false;
    };
    figure.addEventListener("mousedown", () => show());

    bar.append(srcSel, typeSel, selInp, filterInp, sortInp, orderSel, capInp);
    return bar;
  }

  /**
   * The math/diagram inspector: a textarea with the block's
   * source (LaTeX / Mermaid) - the whole point of the bar is not
   * dropping to the Markdown view to edit generated figures.
   */
  private buildTextInspector(
    figure: HTMLElement,
    idx: number,
    kind: "math" | "diagram",
  ): HTMLElement {
    const bar = this.figureBar();
    const ta = document.createElement("textarea");
    ta.className = "insp-source-text";
    ta.rows = 3;
    ta.placeholder = kind === "math" ? "LaTeX source" : "Mermaid source";
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        apply();
      }
    });
    ta.addEventListener("change", () => apply());

    const apply = (): void => {
      const block = this.doc?.blocks[idx];
      if (!block) return;
      if (kind === "math" && block.kind === "math") {
        block.text = ta.value;
        void this.drawMath(figure);
      } else if (kind === "diagram" && block.kind === "diagram") {
        block.diagram.text = ta.value;
        void this.drawDiagram(figure);
      }
      this.emitChange();
    };

    const show = (): void => {
      const block = this.doc?.blocks[idx];
      if (!block) return;
      if (kind === "math" && block.kind === "math") ta.value = block.text;
      if (kind === "diagram" && block.kind === "diagram")
        ta.value = block.diagram.text;
      bar.hidden = false;
    };
    figure.addEventListener("mousedown", () => show());

    bar.appendChild(ta);
    return bar;
  }

  /** Populate and reveal the inspector for one column. */
  private showInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    c: number,
  ): void {
    const bar = figure.querySelector<HTMLElement>(".folio-inspector");
    const col = block.table.columns[c];
    if (!bar || !col) return;
    const colSel = bar.querySelector<HTMLSelectElement>(".insp-col");
    if (colSel) {
      colSel.textContent = "";
      block.table.columns.forEach((cc, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = cc.name;
        colSel.appendChild(o);
      });
      colSel.selectedIndex = c;
    }
    const typeSel = bar.querySelector<HTMLSelectElement>(".insp-type");
    if (typeSel) typeSel.value = col.type;
    const unitInp = bar.querySelector<HTMLInputElement>(".insp-unit");
    if (unitInp) unitInp.value = col.unit ?? "";
    const fmtSel = bar.querySelector<HTMLSelectElement>(".insp-format");
    if (fmtSel) fmtSel.value = col.format === "percent" ? "percent" : "default";
    const exprInp = bar.querySelector<HTMLInputElement>(".insp-expr");
    if (exprInp) {
      exprInp.value = col.expr ?? "";
      exprInp.disabled = col.type !== "formula";
      exprInp.hidden = col.type !== "formula";
    }
    const fx = bar.querySelector<HTMLElement>(".insp-fx");
    if (fx) fx.hidden = col.type !== "formula";
    const capInp = bar.querySelector<HTMLInputElement>(".insp-caption");
    if (capInp) capInp.value = block.table.caption ?? "";
    bar.hidden = false;
  }

  /** Apply a column patch: model write, table re-render, re-show. */
  private patchColumn(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    c: number,
    patch: {
      type?: "text" | "number" | "formula";
      unit?: string | undefined;
      format?: "percent" | undefined;
      expr?: string;
    },
  ): void {
    const col = block.table.columns[c];
    if (!col) return;
    // An undefined value removes the key so the default applies.
    if ("type" in patch) col.type = patch.type ?? col.type;
    if ("unit" in patch) {
      if (patch.unit) col.unit = patch.unit;
      else delete col.unit;
    }
    if ("format" in patch) {
      if (patch.format) col.format = patch.format;
      else delete col.format;
    }
    if ("expr" in patch) col.expr = patch.expr;
    const host = figure.parentElement;
    this.refreshTableBlock(figure, block);
    if (host) {
      const fresh = host.querySelector(
        `figure[data-table-id="${block.table.id}"]`,
      ) as HTMLElement | null;
      if (fresh) this.showInspector(fresh, block, c);
    }
    this.emitChange();
  }

  /**
   * An image block (spec: docs/specs/images.md): generated output
   * like every figure - the img and caption are never editable in
   * place; the inspector owns alt, caption, and file replacement.
   */
  private renderImage(
    block: Extract<Doc["blocks"][number], { kind: "image" }>,
    idx: number,
  ): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "folio-image";
    figure.dataset.blockIndex = String(idx);
    figure.dataset.imageId = block.image.id;
    // Selectable (tabindex) so Backspace/Delete on a selected
    // image removes the block - the diagram affordance.
    figure.contentEditable = "false";
    figure.tabIndex = -1;
    figure.title = "Image - Backspace or Delete removes it";
    figure.appendChild(this.buildImageInspector(figure, block));
    const img = document.createElement("img");
    img.src = block.image.src;
    img.alt = block.image.alt ?? "";
    figure.appendChild(img);
    if (block.image.caption) {
      const cap = document.createElement("figcaption");
      cap.textContent = block.image.caption;
      figure.appendChild(cap);
    }
    return figure;
  }

  /**
   * The image inspector: alt text, caption, and a replace-file
   * control - the whole image directive editable from the document
   * view, on the uniform bar contract.
   */
  private buildImageInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "image" }>,
  ): HTMLElement {
    const bar = this.figureBar();
    const image = block.image;

    const altInp = document.createElement("input");
    altInp.className = "insp-alt";
    altInp.type = "text";
    altInp.placeholder = "alt text";
    altInp.title = "Alt text - what the image shows (empty removes it)";
    const altPatch = (): void => {
      const v = altInp.value.trim();
      if (v) image.alt = v;
      else delete image.alt;
      const img = figure.querySelector("img");
      if (img) img.alt = v;
      this.emitChange();
    };
    altInp.addEventListener("change", altPatch);
    altInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        altInp.blur();
      }
    });

    const capInp = document.createElement("input");
    capInp.className = "insp-caption";
    capInp.type = "text";
    capInp.placeholder = "caption";
    capInp.title = "Figure caption (empty removes it)";
    const capPatch = (): void => {
      const v = capInp.value.trim();
      if (v) image.caption = v;
      else delete image.caption;
      const cap = figure.querySelector("figcaption");
      if (v && cap) cap.textContent = v;
      else if (v && !cap) {
        const el = document.createElement("figcaption");
        el.textContent = v;
        figure.appendChild(el);
      } else if (!v && cap) {
        cap.remove();
      }
      this.emitChange();
    };
    capInp.addEventListener("change", capPatch);
    capInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        capInp.blur();
      }
    });

    const fileInp = document.createElement("input");
    fileInp.className = "insp-file";
    fileInp.type = "file";
    fileInp.accept = "image/*";
    fileInp.title = "Replace the image file";
    fileInp.addEventListener("change", () => {
      const f = fileInp.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        if (typeof reader.result !== "string") return;
        image.src = reader.result;
        const img = figure.querySelector("img");
        if (img) img.src = image.src;
        this.emitChange();
      };
      reader.readAsDataURL(f);
      fileInp.value = "";
    });

    const show = (): void => {
      altInp.value = image.alt ?? "";
      capInp.value = image.caption ?? "";
      bar.hidden = false;
    };
    figure.addEventListener("mousedown", () => show());
    bar.append(altInp, capInp, fileInp);
    return bar;
  }

  /**
   * Insert a ready-made table block after the caret's block (or at
   * the end without a caret). The host uses this for imports: the
   * parsed data is already a model table - the import SNAPSHOT
   * (ADR-0005) - with its provenance in table.import.
   */
  insertImportedTable(table: Table): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(at, 0, { kind: "table", table });
    this.render();
    this.emitChange("insert");
  }

  /**
   * Embedded audio: the media sibling of the image figure. The
   * NATIVE <audio controls> element plays the src (a data URI is
   * offline; an external URL renders opportunistically) - media,
   * not execution, so the document stays a document. Same bar
   * contract as the image inspector: alt, caption, replace file.
   */
  private renderAudio(
    block: Extract<Doc["blocks"][number], { kind: "audio" }>,
    idx: number,
  ): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "folio-audio";
    figure.dataset.blockIndex = String(idx);
    figure.dataset.audioId = block.audio.id;
    // Selectable (tabindex) so Backspace/Delete on a selected
    // audio figure removes the block - the figure affordance.
    figure.contentEditable = "false";
    figure.tabIndex = -1;
    figure.title = "Audio - Backspace or Delete removes it";
    figure.appendChild(this.buildAudioInspector(figure, block));
    // The native widget swallows pointer events (its controls live
    // in a UA shadow DOM), so the ALT TEXT strip is the figure's
    // clickable identity - click it to reveal the inspector, like
    // a code block's header. It also names the sound in print.
    const label = document.createElement("div");
    label.className = "folio-audio-label";
    label.textContent = block.audio.alt || "audio clip";
    figure.appendChild(label);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = block.audio.src;
    audio.title = block.audio.alt ?? "";
    figure.appendChild(audio);
    if (block.audio.caption) {
      const cap = document.createElement("figcaption");
      cap.textContent = block.audio.caption;
      figure.appendChild(cap);
    }
    return figure;
  }

  /** The audio inspector: alt text, caption, and a replace-file
   * control - the whole audio directive editable from the
   * document view, on the uniform bar contract. */
  private buildAudioInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "audio" }>,
  ): HTMLElement {
    const bar = this.figureBar();
    const clip = block.audio;

    const altInp = document.createElement("input");
    altInp.className = "insp-alt";
    altInp.type = "text";
    altInp.placeholder = "alt text";
    altInp.title = "Alt text - what the sound is (empty removes it)";
    const altPatch = (): void => {
      const v = altInp.value.trim();
      if (v) clip.alt = v;
      else delete clip.alt;
      const audio = figure.querySelector("audio");
      if (audio) audio.title = v;
      const label = figure.querySelector(".folio-audio-label");
      if (label) label.textContent = v || "audio clip";
      this.emitChange();
    };
    altInp.addEventListener("change", altPatch);
    altInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        altInp.blur();
      }
    });

    const capInp = document.createElement("input");
    capInp.className = "insp-caption";
    capInp.type = "text";
    capInp.placeholder = "caption";
    capInp.title = "Figure caption (empty removes it)";
    const capPatch = (): void => {
      const v = capInp.value.trim();
      if (v) clip.caption = v;
      else delete clip.caption;
      const cap = figure.querySelector("figcaption");
      if (v && cap) cap.textContent = v;
      else if (v && !cap) {
        const el = document.createElement("figcaption");
        el.textContent = v;
        figure.appendChild(el);
      } else if (!v && cap) {
        cap.remove();
      }
      this.emitChange();
    };
    capInp.addEventListener("change", capPatch);
    capInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        capInp.blur();
      }
    });

    const fileInp = document.createElement("input");
    fileInp.className = "insp-file";
    fileInp.type = "file";
    fileInp.accept = "audio/*";
    fileInp.title = "Replace the audio file";
    fileInp.addEventListener("change", () => {
      const f = fileInp.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        if (typeof reader.result !== "string") return;
        clip.src = reader.result;
        const audio = figure.querySelector("audio");
        if (audio) audio.src = clip.src;
        this.emitChange();
      };
      reader.readAsDataURL(f);
      fileInp.value = "";
    });

    const show = (): void => {
      altInp.value = clip.alt ?? "";
      capInp.value = clip.caption ?? "";
      bar.hidden = false;
    };
    // The native <audio> widget swallows pointer events inside its
    // UA shadow DOM - a mousedown on the player never reaches the
    // figure. Focus DOES bubble: clicking or tabbing to the player
    // reveals the bar the same way.
    figure.addEventListener("mousedown", () => show());
    figure.addEventListener("focusin", () => show());
    bar.append(altInp, capInp, fileInp);
    return bar;
  }

  /**
   * Insert an image block after the caret's block (the toolbar's
   * image button in document view). src is a data URI from the
   * host's file picker, or any URL. Ids count per document, like
   * the parser's hand-typed form.
   */
  insertImage(src: string, alt?: string): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    let n = 0;
    for (const b of this.doc.blocks) {
      if (b.kind === "image") n += 1;
    }
    const image: Image = {
      id: `image-${n + 1}`,
      src,
      ...(alt ? { alt } : {}),
    };
    this.doc.blocks.splice(at, 0, { kind: "image", image });
    this.render();
    this.emitChange("insert");
  }

  /**
   * Insert an audio block after the caret's block (the toolbar's
   * audio button in document view). src is a data URI from the
   * host's file picker, or any URL. Ids count per document.
   */
  insertAudio(src: string, alt?: string): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    let n = 0;
    for (const b of this.doc.blocks) {
      if (b.kind === "audio") n += 1;
    }
    const clip: Audio = {
      id: `audio-${n + 1}`,
      src,
      ...(alt ? { alt } : {}),
    };
    this.doc.blocks.splice(at, 0, { kind: "audio", audio: clip });
    this.render();
    this.emitChange("insert");
  }

  /** The theme's in-flow row window (table.rows.show, default 50). */
  private tableRowsWindow(): number {
    if (!this.doc) return 50;
    return themeFromDoc(this.doc).tableRowsShow;
  }

  /**
   * The dataset browser (spec: docs/specs/dataset-browser.md): a
   * dedicated, viewport-owning surface for a table of any size.
   * The in-flow figure shows a head window; this overlay is where
   * the full dataset is browsed - continuous virtualized scrolling,
   * a Jexl filter (the charts' language), click-header sorting,
   * and cell editing. It is a model projection like every
   * inspector: edits are model writes; the browser never becomes
   * a source of truth. Esc or Done closes it.
   */
  openDataset(tableId: string): void {
    if (!this.doc) return;
    const block = this.doc.blocks.find(
      (b) => b.kind === "table" && b.table.id === tableId,
    );
    if (!block || block.kind !== "table") return;
    let overlay = this.dsBrowser;
    if (overlay === null || this.shadowRoot?.contains(overlay) !== true) {
      overlay = this.buildDatasetBrowser();
      this.dsBrowser = overlay;
      this.shadowRoot?.appendChild(overlay);
    }
    overlay.dataset.tableId = tableId;
    this.dsState = { filter: "", sortBy: null, sortDir: "asc" };
    const filter = overlay.querySelector<HTMLInputElement>(".folio-ds-filter");
    if (filter) filter.value = "";
    overlay.hidden = false;
    this.refreshDatasetBrowser();
    filter?.focus();
  }

  private closeDataset(): void {
    if (this.dsBrowser) this.dsBrowser.hidden = true;
  }

  private buildDatasetBrowser(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "folio-ds-overlay";
    overlay.hidden = true;
    overlay.contentEditable = "false";
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        this.closeDataset();
      }
    });

    const panel = document.createElement("div");
    panel.className = "folio-ds-panel";

    const head = document.createElement("div");
    head.className = "folio-ds-head";
    const title = document.createElement("span");
    title.className = "folio-ds-title";
    const filter = document.createElement("input");
    filter.className = "folio-ds-filter";
    filter.type = "text";
    filter.placeholder = 'filter (Jexl), e.g. v > 100 && region != "South"';
    filter.addEventListener("input", () => {
      this.dsState.filter = filter.value.trim();
      this.refreshDatasetBrowser();
    });
    const count = document.createElement("span");
    count.className = "folio-ds-count";
    const done = document.createElement("button");
    done.className = "folio-ds-done";
    done.type = "button";
    done.textContent = "Done";
    done.addEventListener("click", () => this.closeDataset());
    head.append(title, filter, count, done);

    const grid = document.createElement("div");
    grid.className = "folio-ds-grid";
    // Focusable so Esc keeps working after a cell editor closes
    // (removing the focused input would strand focus on the body).
    grid.tabIndex = -1;
    const canvas = document.createElement("div");
    canvas.className = "folio-ds-canvas";
    grid.appendChild(canvas);
    grid.addEventListener("scroll", () => {
      this.renderDatasetRows();
    });

    panel.append(head, grid);
    overlay.appendChild(panel);
    return overlay;
  }

  /** The model row indexes currently displayed (filter, then sort). */
  private datasetDisplayIndexes(): {
    indexes: number[];
    error: string | null;
  } {
    const overlay = this.dsBrowser;
    const tableId = overlay?.dataset.tableId;
    const block = this.doc?.blocks.find(
      (b) => b.kind === "table" && b.table.id === tableId,
    );
    if (!block || block.kind !== "table") {
      return { indexes: [], error: "table not found" };
    }
    let recalced: Table;
    try {
      recalced = recalcTable(block.table, this.tablePool());
    } catch (e) {
      return {
        indexes: [],
        error: `Table error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    let indexes: number[];
    try {
      indexes =
        this.dsState.filter === ""
          ? recalced.rows.map((_, i) => i)
          : filterIndexes(recalced, this.dsState.filter);
    } catch (e) {
      return {
        indexes: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
    if (this.dsState.sortBy !== null) {
      // Sort the FILTERED subset: sort all rows, keep only the
      // filtered indexes, in the sorted order.
      const keep = new Set(indexes);
      const by = this.dsState.sortBy;
      const dir = this.dsState.sortDir;
      indexes = sortIndexes(recalced, by, dir).filter((i) => keep.has(i));
    }
    return { indexes, error: null };
  }

  /** Recompute the display and redraw the visible window. */
  private refreshDatasetBrowser(): void {
    const overlay = this.dsBrowser;
    if (!overlay || overlay.hidden) return;
    const tableId = overlay.dataset.tableId;
    const block = this.doc?.blocks.find(
      (b) => b.kind === "table" && b.table.id === tableId,
    );
    if (!block || block.kind !== "table") return;
    const title = overlay.querySelector<HTMLElement>(".folio-ds-title");
    if (title) title.textContent = `@${block.table.id}`;
    const { indexes, error } = this.datasetDisplayIndexes();
    const count = overlay.querySelector<HTMLElement>(".folio-ds-count");
    if (count) {
      const filtered =
        this.dsState.filter === ""
          ? ""
          : ` of ${block.table.rows.length.toLocaleString()} · filtered`;
      const sorted =
        this.dsState.sortBy === null
          ? ""
          : ` · sorted by ${this.dsState.sortBy} ${this.dsState.sortDir}`;
      count.textContent =
        error === null
          ? `${indexes.length.toLocaleString()} rows${filtered}${sorted}`
          : error;
    }
    const grid = overlay.querySelector<HTMLElement>(".folio-ds-grid");
    const canvas = overlay.querySelector<HTMLElement>(".folio-ds-canvas");
    if (!grid || !canvas) return;
    canvas.style.height = `${indexes.length * 32 + 32}px`;
    this.renderDatasetHeader();
    this.renderDatasetRows();
  }

  private renderDatasetHeader(): void {
    const overlay = this.dsBrowser;
    const tableId = overlay?.dataset.tableId;
    const block = this.doc?.blocks.find(
      (b) => b.kind === "table" && b.table.id === tableId,
    );
    const canvas = overlay?.querySelector<HTMLElement>(".folio-ds-canvas");
    if (!overlay || !canvas || !block || block.kind !== "table") return;
    let header = canvas.querySelector<HTMLElement>(".folio-ds-header");
    if (header === null) {
      header = document.createElement("div");
      header.className = "folio-ds-header";
      canvas.appendChild(header);
    }
    header.textContent = "";
    const cols = block.table.columns
      .map((c) => c.name)
      .map((n) => `${n}`)
      .join(" ");
    header.style.gridTemplateColumns = `repeat(${
      block.table.columns.length
    }, minmax(110px, 1fr))`;
    block.table.columns.forEach((col) => {
      const cell = document.createElement("div");
      cell.className = "folio-ds-hcell";
      cell.textContent = col.name;
      if (this.dsState.sortBy === col.name) {
        cell.classList.add("sorted");
        cell.textContent =
          this.dsState.sortDir === "asc" ? `${col.name} ▲` : `${col.name} ▼`;
      }
      cell.title = `Sort by ${col.name}`;
      cell.addEventListener("click", () => {
        if (this.dsState.sortBy === col.name) {
          this.dsState.sortDir =
            this.dsState.sortDir === "asc" ? "desc" : "asc";
        } else {
          this.dsState.sortBy = col.name;
          this.dsState.sortDir = "asc";
        }
        this.refreshDatasetBrowser();
      });
      header.appendChild(cell);
    });
    void cols;
  }

  /** Draw the visible slice of the (filtered, sorted) row window. */
  private renderDatasetRows(): void {
    const overlay = this.dsBrowser;
    if (!overlay || overlay.hidden) return;
    const tableId = overlay.dataset.tableId;
    const block = this.doc?.blocks.find(
      (b) => b.kind === "table" && b.table.id === tableId,
    );
    const grid = overlay.querySelector<HTMLElement>(".folio-ds-grid");
    const canvas = overlay.querySelector<HTMLElement>(".folio-ds-canvas");
    if (!grid || !canvas || !block || block.kind !== "table") return;
    let recalced: Table;
    try {
      recalced = recalcTable(block.table, this.tablePool());
    } catch {
      return; // the head already shows the guarded error line
    }
    const { indexes } = this.datasetDisplayIndexes();
    const first = Math.max(0, Math.floor(grid.scrollTop / 32) - 2);
    const count = Math.ceil(grid.clientHeight / 32) + 4;
    const slice = indexes.slice(first, first + count);
    for (const el of Array.from(
      canvas.querySelectorAll<HTMLElement>(".folio-ds-row"),
    )) {
      el.remove();
    }
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const figure = host?.querySelector(
      `figure[data-table-id="${block.table.id}"]`,
    ) as HTMLElement | null;
    slice.forEach((modelRow, displayPos) => {
      const row = document.createElement("div");
      row.className = "folio-ds-row";
      row.style.top = `${(first + displayPos) * 32 + 32}px`;
      row.style.gridTemplateColumns = `repeat(${
        block.table.columns.length
      }, minmax(110px, 1fr))`;
      row.dataset.modelRow = String(modelRow);
      block.table.columns.forEach((col, c) => {
        const cell = document.createElement("div");
        cell.className = "folio-ds-cell";
        cell.dataset.col = String(c);
        const v = recalced.rows[modelRow]?.[c];
        if (col.type === "formula") {
          cell.classList.add("computed");
          cell.textContent =
            col.format === "percent" && typeof v === "number"
              ? `${(v * 100).toFixed(1)}%`
              : String(v ?? "");
        } else {
          if (typeof v === "number") cell.classList.add("num");
          cell.textContent = String(v ?? "");
          cell.addEventListener("click", () => {
            const active =
              canvas.querySelector<HTMLInputElement>(".folio-ds-edit");
            if (active !== null) return; // one editor at a time
            this.openDatasetCellEditor(row, cell, modelRow, c, block);
          });
        }
        row.appendChild(cell);
      });
      void figure;
      canvas.appendChild(row);
    });
  }

  /**
   * Edit one cell in the browser: an input over the cell, commit on
   * Enter/blur (a model write rippling through formulas, the
   * in-flow figure, and charts), Escape reverts.
   */
  private openDatasetCellEditor(
    row: HTMLElement,
    cell: HTMLElement,
    modelRow: number,
    c: number,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const input = document.createElement("input");
    input.className = "folio-ds-edit";
    input.type = "text";
    input.value = String(block.table.rows[modelRow]?.[c] ?? "");
    cell.textContent = "";
    cell.appendChild(input);
    input.focus();
    const commit = (): void => {
      const text = input.value.trim();
      const value: Cell = /^-?[0-9]+(\.[0-9]+)?$/.test(text)
        ? parseFloat(text)
        : text;
      const target = block.table.rows[modelRow];
      if (target && target[c] !== value) {
        target[c] = value;
        const host = this.shadowRoot?.querySelector("article.folio-doc");
        const figure = host?.querySelector(
          `figure[data-table-id="${block.table.id}"]`,
        ) as HTMLElement | null;
        // The in-flow figure's edited cell must not go stale: the
        // browser's edit is not its DOM, so refresh the rendered
        // cell (if it is inside the head window) like a blur commit
        // would have.
        const td = figure?.querySelector(
          `td[data-row-index="${String(modelRow)}"][data-col-index="${String(c)}"]`,
        );
        if (td) td.textContent = String(value);
        try {
          this.updateRowCalculations(figure, block);
        } catch {
          if (figure) this.refreshTableBlock(figure, block);
        }
        this.emitChange();
      }
      this.refreshDatasetBrowser();
      const grid = this.dsBrowser?.querySelector<HTMLElement>(".folio-ds-grid");
      grid?.focus();
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        this.refreshDatasetBrowser();
      } else if (ev.key === "Tab") {
        ev.preventDefault();
        commit();
        const cells = Array.from(
          row.querySelectorAll<HTMLElement>(".folio-ds-cell"),
        );
        const next = cells
          .slice(c + 1)
          .find((el) => !el.classList.contains("computed"));
        if (next) (next as HTMLElement).click();
      }
    });
    input.addEventListener("blur", commit);
  }

  /**
   * The rendition (spec: docs/specs/dark-light-mode.md): the host's
   * ambient mode, `<folio-doc mode="dark">`. Anything else is light
   * - an unstyled host gets the light rendition.
   */
  private mode(): Mode {
    return this.getAttribute("mode") === "dark" ? "dark" : "light";
  }

  /**
   * Re-dress for a mode change WITHOUT a re-render: swap the theme
   * stylesheet and re-paint the figures that bake colors in (charts,
   * diagrams). The article, the caret, and any open inspector stay
   * exactly where they were.
   */
  private restyle(): void {
    const root = this.shadowRoot;
    if (!this.doc || !root) return;
    const style = root.querySelector("style#folio-theme");
    if (style)
      style.textContent = themeCss(themeFromDoc(this.doc), this.mode());
    for (const fig of Array.from(
      root.querySelectorAll<HTMLElement>("[data-chart-source]"),
    )) {
      this.drawChart(fig);
    }
    for (const fig of Array.from(
      root.querySelectorAll<HTMLElement>("[data-diagram-id]"),
    )) {
      void this.drawDiagram(fig);
    }
  }

  private drawChart(figure: HTMLElement): void {
    if (!this.doc) return;
    // A chart figure is its BLOCK, not its source: several charts
    // can (and do) plot different queries over the same table -
    // resolving by source here rendered the FIRST chart's query in
    // every figure over that table. The block index, stamped
    // positionally by the renderer, is the figure's identity.
    const idx = Number(figure.dataset.blockIndex ?? "-1");
    const byIndex = this.doc.blocks[idx];
    const source = figure.dataset.chartSource;
    const block =
      byIndex !== undefined && byIndex.kind === "chart"
        ? byIndex
        : this.doc.blocks.find(
            (b) => b.kind === "chart" && b.chart.source === source,
          );
    if (!block || block.kind !== "chart") return;
    const holder = figure.querySelector<HTMLElement>(".chart-holder");
    if (!holder) return;
    try {
      const tableBlock = this.doc.blocks.find(
        (b) => b.kind === "table" && b.table.id === block.chart.source,
      );
      if (!tableBlock || tableBlock.kind !== "table") {
        throw new Error(`chart source table '${block.chart.source}' not found`);
      }
      const recalced = recalcTable(tableBlock.table, this.tablePool());
      const result = executeQuery(recalced, block.chart);
      // The chart dresses from the theme: the series color comes
      // from the palette, and the axis titles name the query's
      // columns (with the value column's unit) - a chart that
      // explains itself.
      const theme = themeFromDoc(this.doc);
      // Charts dress in order: the second chart on a page should
      // not wear the first chart's color. Rotation is by the
      // chart's position among the document's chart blocks, so a
      // chart keeps its color through re-renders.
      const ordinal = this.doc.blocks
        .filter((b) => b.kind === "chart")
        .indexOf(block);
      // Each theme palette is hand-tuned for both renditions (the
      // dark set is lighter, never neon); the axes take the theme's
      // own ink so a chart sits in its page.
      const mode = this.mode();
      const palette = theme.palette[mode];
      const ink = theme.colors[mode];
      const seriesColor = palette[ordinal % palette.length] ?? "#3d5a98";
      const select = block.chart.query.select;
      const valueCol = select[select.length - 1] ?? "";
      const unit =
        tableBlock.table.columns.find((c) => c.name === valueCol)?.unit ??
        undefined;
      const style: ChartStyle = {
        color: seriesColor,
        colors: palette,
        text: ink.ink,
        textMuted: ink.muted,
        grid: ink.hairline,
        paper: ink.paper,
        xTitle: select[0],
        yTitle:
          valueCol === ""
            ? undefined
            : `${valueCol}${unit ? ` (${unit})` : ""}`,
      };
      holder.innerHTML =
        block.chart.type === "line"
          ? renderLineChart(result, style).svg
          : block.chart.type === "area"
            ? renderAreaChart(result, style).svg
            : block.chart.type === "scatter"
              ? renderScatterChart(result, style).svg
              : block.chart.type === "pie"
                ? renderPieChart(result, false, style).svg
                : block.chart.type === "donut"
                  ? renderPieChart(result, true, style).svg
                  : renderBarChart(result, style).svg;
    } catch (e) {
      holder.textContent = `Chart error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  /**
   * Render a diagram block with Mermaid (ADR-0010). The library is
   * loaded lazily via dynamic import so documents without diagrams
   * never pay for it; it is bundled, so rendering is offline.
   */
  private async drawDiagram(figure: HTMLElement): Promise<void> {
    if (!this.doc) return;
    const id = figure.dataset.diagramId;
    const block = this.doc.blocks.find(
      (b) => b.kind === "diagram" && b.diagram.id === id,
    );
    const holder = figure.querySelector<HTMLElement>(".diagram-holder");
    if (!block || block.kind !== "diagram" || !holder) return;
    try {
      const mermaid = (await import("mermaid")).default;
      // Diagrams dress from the theme and the rendition: mermaid's
      // `base` theme takes the page's own fonts and colors, so a
      // diagram belongs to its document in either mode.
      const theme = themeFromDoc(this.doc);
      const c = theme.colors[this.mode()];
      mermaid.initialize({
        securityLevel: "strict",
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          darkMode: this.mode() === "dark",
          // A pale halo on every node reads as a glow on dark paper.
          dropShadow: "none",
          fontFamily: theme.bodyFont,
          background: c.paper,
          primaryColor: c.tint,
          primaryTextColor: c.ink,
          primaryBorderColor: c.accent,
          secondaryColor: c.paper,
          tertiaryColor: c.paper,
          lineColor: c.muted,
          textColor: c.ink,
          mainBkg: c.tint,
          nodeBorder: c.accent,
          clusterBkg: c.paper,
          clusterBorder: c.hairline,
          edgeLabelBackground: c.paper,
          noteBkgColor: c.tint,
          noteTextColor: c.ink,
          noteBorderColor: c.hairline,
          actorBkg: c.tint,
          actorBorder: c.accent,
          actorTextColor: c.ink,
          signalColor: c.ink,
          signalTextColor: c.ink,
        },
      });
      const { svg } = await mermaid.render(
        `folio-diagram-${id}`,
        block.diagram.text,
      );
      if (figure.isConnected) holder.innerHTML = svg;
    } catch (e) {
      if (figure.isConnected) {
        holder.textContent = `Diagram error: ${
          e instanceof Error ? e.message : String(e)
        }`;
      }
    }
  }

  /**
   * Render a math block with KaTeX (ADR-0011). Loaded lazily like
   * mermaid so documents without math never pay for it; bundled, so
   * rendering stays offline. The KaTeX stylesheet is injected into
   * this shadow root (scoped trees cannot see page CSS) on first
   * use. throwOnError: false renders bad LaTeX as visible inline
   * error text, matching the diagram error contract.
   */
  private async drawMath(figure: HTMLElement): Promise<void> {
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const block = this.doc?.blocks[idx];
    const holder = figure.querySelector<HTMLElement>(".math-holder");
    if (!block || block.kind !== "math" || !holder) return;
    try {
      const [katexMod, cssMod] = await Promise.all([
        import("katex"),
        import("katex/dist/katex.min.css?inline"),
      ]);
      const root = this.shadowRoot;
      if (root && root.querySelector("style#folio-katex") === null) {
        const style = document.createElement("style");
        style.id = "folio-katex";
        style.textContent = (cssMod as unknown as { default: string }).default;
        root.appendChild(style);
      }
      const html = katexMod.default.renderToString(block.text, {
        displayMode: true,
        throwOnError: false,
      });
      if (figure.isConnected) holder.innerHTML = html;
    } catch (e) {
      if (figure.isConnected) {
        holder.textContent = `Math error: ${
          e instanceof Error ? e.message : String(e)
        }`;
      }
    }
  }

  /**
   * Rebuild the block list from the article's children. Text blocks
   * (prose, headings, code) are re-derived wholesale - the DOM is
   * the source of truth during typing, including native structural
   * edits (Enter splits, Backspace merges). Generated blocks
   * (tables, charts, diagrams) carry their structured data in the
   * model only, so they are preserved by figure identity, in
   * document order.
   */
  private syncFromDom(): void {
    if (!this.doc) return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return;
    const generated = this.doc.blocks.filter(
      (b) =>
        b.kind === "table" ||
        b.kind === "chart" ||
        b.kind === "diagram" ||
        b.kind === "math" ||
        b.kind === "image" ||
        b.kind === "audio",
    );
    let gi = 0;
    const next: DocBlock[] = [];
    for (const child of Array.from(host.children)) {
      const el = child as HTMLElement;
      if (el.tagName === "FIGURE" && el.classList.contains("folio-codeblock")) {
        // A code block renders as a figure (its header is the
        // inspector) but stays a text block: the body is re-derived
        // from the DOM like prose. Syntax colors and strudel's
        // playing lights are spans over the text - innerText reads
        // through them.
        const code = el.querySelector<HTMLElement>("pre.folio-code > code");
        next.push({
          kind: "code",
          ...(el.dataset.lang !== undefined ? { lang: el.dataset.lang } : {}),
          text: code ? code.innerText : "",
        });
        continue;
      }
      if (el.tagName === "FIGURE") {
        const g = generated[gi];
        gi += 1;
        if (g) next.push(g);
        continue;
      }
      const headingMatch = /^H([1-6])$/.exec(el.tagName);
      if (headingMatch) {
        next.push({
          kind: "heading",
          level: Number(headingMatch[1]),
          text: el.textContent ?? "",
        });
        continue;
      }
      if (el.tagName === "PRE" && el.querySelector("code") !== null) {
        next.push({
          kind: "code",
          ...(el.dataset.lang !== undefined ? { lang: el.dataset.lang } : {}),
          text: el.innerText,
        });
        continue;
      }
      const md = htmlToInlineMarkdown(el.innerHTML).replace(/\n+$/, "");
      next.push({ kind: "prose", text: md });
    }
    // Native structural edits (Enter splits) create elements without
    // a block index; re-stamp positionally so index-based lookups
    // (setBlockKind, toggleCodeBlock, caret tracking) keep working
    // between renders. Only when the child count matches the rebuilt
    // model - otherwise the DOM is not 1:1 and stamping would lie.
    if (next.length === host.children.length) {
      Array.from(host.children).forEach((child, i) => {
        (child as HTMLElement).dataset.blockIndex = String(i);
      });
    }
    this.doc.blocks = next;
  }

  private handleInput(ev?: Event): void {
    if (
      ev?.target instanceof Element &&
      ev.target.closest(".folio-inspector")
    ) {
      return;
    }
    this.syncFromDom();
    this.commitCaretCell();
    this.freezeStrudelLights();
    this.emitChange("type");
  }

  /**
   * Commit the cell the caret is in, if any. Typing steals focus
   * from the cell to the article after the first keystroke, so
   * blur-based commits alone left everything after the first
   * character dangling in the DOM. Committing per keystroke is
   * idempotent and keeps formulas and the Markdown source live.
   */
  private commitCaretCell(): void {
    if (!this.doc) return;
    const cell = this.resolveCell(null);
    if (!cell) return;
    const figure = cell.closest("figure");
    const idx = Number(figure?.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    this.commitCell(cell, block);
  }

  private handleCellBlur(ev: FocusEvent): void {
    const td = ev.target as HTMLTableCellElement;
    if (!td.dataset.rowIndex || !this.doc) return;
    const figure = td.closest("figure");
    const idx = Number(figure?.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    this.commitCell(td, block);
  }

  /**
   * Write the cell's text into the model. Idempotent, and surgical:
   * the edited cell is the live DOM, so committing must not re-render
   * the table (that would destroy the caret mid-typing). Only the
   * row's formula cells and the charts are refreshed in place.
   */
  private commitCell(
    td: HTMLTableCellElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const r = Number(td.dataset.rowIndex);
    const c = Number(td.dataset.colIndex);
    const col = block.table.columns[c];
    if (!col || col.type === "formula") return;
    const text = (td.textContent ?? "").trim();
    const value: string | number = /^-?[0-9]+(\.[0-9]+)?$/.test(text)
      ? parseFloat(text)
      : text;
    const row = block.table.rows[r];
    if (!row) return;
    if (row[c] === value) return;
    row[c] = value;
    this.updateRowCalculations(td.closest("figure"), block);
    this.emitChange("cell");
  }

  /** Refresh the row's formula cells and dependent charts in place. */
  private updateRowCalculations(
    figure: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const recalced = recalcTable(block.table, this.tablePool());
    // Formulas may reference other rows (_prev, name:row), so an
    // edit ripples through every formula cell of the table, not
    // just the edited row. Text-only updates: no structural
    // re-render, the caret in the edited cell is untouched.
    block.table.columns.forEach((col, c) => {
      if (col.type !== "formula") return;
      for (let row = 0; row < block.table.rows.length; row++) {
        const cell = figure?.querySelector(
          `td[data-row-index="${String(row)}"][data-col-index="${String(c)}"]`,
        );
        if (!cell) continue;
        const v = recalced.rows[row]?.[c];
        cell.textContent =
          col.format === "percent" && typeof v === "number"
            ? `${(v * 100).toFixed(1)}%`
            : String(v ?? "");
        cell.classList.toggle("num", typeof v === "number");
      }
    });
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const chartFigures = Array.from(
      host?.querySelectorAll<HTMLElement>("[data-chart-source]") ?? [],
    );
    for (const cf of chartFigures) {
      this.drawChart(cf);
    }
    // Cross-table references ripple: another table's formulas may
    // read this one (budget.r3.q2), so their cells refresh too -
    // text-only updates in place, the edited caret untouched.
    for (const other of this.doc?.blocks ?? []) {
      if (other.kind !== "table" || other.table.id === block.table.id) {
        continue;
      }
      const otherFigure = host?.querySelector(
        `figure[data-table-id="${other.table.id}"]`,
      ) as HTMLElement | null;
      if (!otherFigure) continue;
      let recalcedOther;
      try {
        recalcedOther = recalcTable(other.table, this.tablePool());
      } catch {
        continue; // its own error renders on its next full render
      }
      other.table.columns.forEach((col, c) => {
        if (col.type !== "formula") return;
        for (let row = 0; row < other.table.rows.length; row++) {
          const cell = otherFigure.querySelector(
            `td[data-row-index="${String(row)}"][data-col-index="${String(c)}"]`,
          );
          if (!cell) continue;
          const v = recalcedOther.rows[row]?.[c];
          cell.textContent =
            col.format === "percent" && typeof v === "number"
              ? `${(v * 100).toFixed(1)}%`
              : String(v ?? "");
          cell.classList.toggle("num", typeof v === "number");
        }
      });
    }
  }

  /**
   * The cell a keyboard event applies to. Engines move focus to the
   * article when text is typed into a nested editable cell (the
   * caret stays in the cell), so the event target is often the
   * article: resolve in order - the event target, the caret (via the
   * shadow root's selection, Chromium), then the last focused cell
   * while focus is still inside this component (WebKitGTK has no
   * pierceable selection API at all).
   */
  private resolveCell(target: EventTarget | null): HTMLTableCellElement | null {
    if (target instanceof Element) {
      const td = target.closest(
        "td[data-row-index]",
      ) as HTMLTableCellElement | null;
      if (td) {
        this.lastCell = td;
        return td;
      }
    }
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    if (sel && sel.anchorNode !== null) {
      let n: Node | null = sel.anchorNode;
      while (n !== null && !(n instanceof HTMLTableCellElement)) {
        n = n.parentNode;
      }
      if (
        n instanceof HTMLTableCellElement &&
        n.dataset.rowIndex !== undefined
      ) {
        this.lastCell = n;
        return n;
      }
      // The caret is resolvable and NOT in a cell: it is
      // authoritative. A stale lastCell must not win here, or Enter
      // in a paragraph after using a table adds a table row instead
      // of splitting the paragraph.
      this.lastCell = null;
      return null;
    }
    // No pierceable selection (WebKitGTK typing in a cell steals
    // focus to the article): the last focused cell is the best
    // available context - but the most recent CLICK still wins:
    // it resolves through the shadow root's hit testing, which is
    // the one pierce available on WebKitGTK. Without this, Enter
    // in a paragraph after using a table grew the table (the
    // focused article kept the stale cell authoritative).
    if (
      this.lastCell !== null &&
      this.shadowRoot?.contains(this.lastCell) === true &&
      this.shadowRoot?.activeElement !== null
    ) {
      if (this.lastBlock !== null && !this.lastBlock.contains(this.lastCell)) {
        this.lastCell = null;
        return null;
      }
      return this.lastCell;
    }
    return null;
  }

  private refreshTableBlock(
    figure: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    if (!figure || !this.doc || !this.shadowRoot) return;
    const host = figure.parentElement;
    if (!host) return;
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const fresh = this.renderTable(block, idx);
    fresh.dataset.blockIndex = String(idx);
    host.replaceChild(fresh, figure);
    const chartFigures = Array.from(
      host.querySelectorAll<HTMLElement>("[data-chart-source]"),
    );
    for (const cf of chartFigures) this.drawChart(cf);
  }

  /**
   * Convert the caret's block to a heading level or a paragraph
   * (the toolbar's H1/H2/P buttons in document view). execCommand
   * cannot act inside the shadow tree, so the conversion is
   * model-level.
   */
  setBlockKind(kind: "h1" | "h2" | "h3" | "p"): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (
      !block ||
      block.kind === "table" ||
      block.kind === "chart" ||
      block.kind === "diagram" ||
      block.kind === "math" ||
      block.kind === "image" ||
      block.kind === "audio"
    ) {
      return;
    }
    const text = block.text;
    if (kind === "p") {
      if (block.kind === "prose") return;
      this.doc.blocks[idx] = { kind: "prose", text };
    } else {
      const level = kind === "h1" ? 1 : kind === "h2" ? 2 : 3;
      if (block.kind === "heading" && block.level === level) return;
      this.doc.blocks[idx] = { kind: "heading", level, text };
    }
    this.render();
    this.emitChange();
    this.focusBlockStart(idx);
  }

  /**
   * Insert an empty Mermaid diagram block after the caret's block
   * (the toolbar's diagram button).
   */
  insertDiagram(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(at, 0, {
      kind: "diagram",
      diagram: {
        id: `diagram-${Date.now().toString(36)}`,
        text: "graph TD\n  A --> B",
      },
    });
    this.render();
    this.emitChange();
  }

  /**
   * The caret position nearest a point inside one paragraph of
   * this component's tree, computed geometrically. Every
   * document-level caret API (caretRangeFromPoint,
   * caretPositionFromPoint, getComposedRanges) retargets to the
   * shadow host in WebKitGTK (verified against 2.54, the Tauri
   * engine), so the only pierce is the shadow root's own hit
   * testing - and even that resolves the block, not the offset.
   * The offset is found by walking the paragraph's text nodes and
   * measuring caret rects. The vertical term dominates: the right
   * line first, then the nearest horizontal position - real
   * users release drags a few pixels off the line.
   */
  private caretFromPointIn(
    p: HTMLElement,
    x: number,
    y: number,
  ): { node: Node; offset: number; dist: number } | null {
    let best: { node: Node; offset: number } | null = null;
    let bestDist = Infinity;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null = walker.nextNode();
    while (node !== null) {
      const len = node.textContent?.length ?? 0;
      for (let i = 0; i <= len; i++) {
        range.setStart(node, i);
        range.collapse(true);
        const rect = range.getClientRects()[0];
        if (rect) {
          const caretX = i === len ? rect.right : rect.left;
          const dx = Math.abs(caretX - x);
          const dy = Math.abs((rect.top + rect.bottom) / 2 - y);
          const dist = dy * 4 + dx;
          if (dist < bestDist) {
            bestDist = dist;
            best = { node, offset: i };
          }
        }
      }
      node = walker.nextNode();
    }
    return best ? { ...best, dist: bestDist } : null;
  }

  /**
   * The caret position nearest a point anywhere in the article's
   * prose, for engines where caretRangeFromPoint does not pierce
   * (WebKitGTK): the best geometric position across every prose
   * paragraph. Chromium's caretRangeFromPoint pierces and handles
   * pointer slop natively, so it is the fast path there.
   */
  private caretOverParagraphs(
    x: number,
    y: number,
  ): { node: Node; offset: number; p: HTMLElement } | null {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return null;
    const pierced = document.caretRangeFromPoint(x, y);
    if (pierced) {
      const n = pierced.startContainer;
      const p = (n instanceof Element ? n : (n.parentElement ?? null))?.closest(
        "p[data-block-index]",
      ) as HTMLElement | null;
      if (p) return { node: n, offset: pierced.startOffset, p };
    }
    let best: { node: Node; offset: number; p: HTMLElement } | null = null;
    let bestDist = Infinity;
    for (const p of Array.from(
      host.querySelectorAll<HTMLElement>("p[data-block-index]"),
    )) {
      const c = this.caretFromPointIn(p, x, y);
      if (c && c.dist < bestDist) {
        bestDist = c.dist;
        best = { node: c.node, offset: c.offset, p };
      }
    }
    return best;
  }

  /**
   * The text Range between two caret points, or null when the two
   * points do not describe a usable non-collapsed prose selection.
   * The endpoints may sit in different paragraphs, but only in
   * ADJACENT ones - a selection spanning a heading or a generated
   * block between the endpoints would wrap non-prose content.
   */
  private rangeBetweenPoints(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): Range | null {
    if (Math.hypot(x1 - x0, y1 - y0) <= 3) return null;
    const c0 = this.caretOverParagraphs(x0, y0);
    const c1 = this.caretOverParagraphs(x1, y1);
    if (!c0 || !c1) return null;
    const adjacent =
      c0.p === c1.p ||
      c0.p.nextElementSibling === c1.p ||
      c1.p.nextElementSibling === c0.p;
    if (!adjacent) return null;
    const range = document.createRange();
    const forward =
      c0.node === c1.node
        ? c0.offset <= c1.offset
        : (c0.node.compareDocumentPosition(c1.node) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
          0;
    const [start, end] = forward ? [c0, c1] : [c1, c0];
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range.collapsed ? null : range;
  }

  /**
   * The word around a point, mirroring the browser's double-click
   * word selection. A drag never runs for a double click, so
   * without this the fallback had nothing to format after the
   * most common selection gesture of all.
   */
  private wordRangeAt(x: number, y: number): Range | null {
    const c = this.caretOverParagraphs(x, y);
    if (!c || c.node.nodeType !== Node.TEXT_NODE) return null;
    const text = c.node.textContent ?? "";
    const isWord = (ch: string | undefined): boolean =>
      ch !== undefined && /[\w]/.test(ch);
    if (!isWord(text[c.offset]) && !isWord(text[c.offset - 1])) {
      return null;
    }
    let s = c.offset;
    let e = c.offset;
    while (s > 0 && isWord(text[s - 1])) s--;
    while (e < text.length && isWord(text[e])) e++;
    if (e <= s) return null;
    const range = document.createRange();
    range.setStart(c.node, s);
    range.setEnd(c.node, e);
    return range;
  }

  /**
   * The first text position inside the range, for the "what you
   * see is what you toggle" rule. A selection that begins exactly
   * at a format boundary (the caret before a <strong> and the
   * caret at its first text position are the same visual point)
   * must still toggle the format its first visible character
   * carries - starting the ancestor walk at the range's raw start
   * container would miss the element and wrap instead.
   */
  private firstPositionNodeInRange(range: Range): Node | null {
    const startNode = range.startContainer;
    const startLen = startNode.textContent?.length ?? 0;
    if (startNode.nodeType === Node.TEXT_NODE && range.startOffset < startLen) {
      return startNode;
    }
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
    );
    let n: Node | null = null;
    while ((n = walker.nextNode()) !== null) {
      if (n === startNode) {
        if (range.startOffset < (n.textContent?.length ?? 0)) return n;
        continue;
      }
      if (range.intersectsNode(n)) return n;
    }
    return null;
  }

  /**
   * Apply (or remove) an inline semantic format around the current
   * selection (the toolbar's inline format buttons in document
   * view). execCommand cannot act on a selection inside the shadow
   * tree, so this wraps the selection range with the semantic
   * element directly - or unwraps the matching ancestor when the
   * selection already carries the format. The selection resolves
   * in order: the shadow root's selection (Chromium), then the
   * last mouse-drag range (WebKitGTK, which exposes no pierceable
   * selection API - without the fallback every click reported
   * "Select some text first"). Returns false when there is nothing
   * usable to format.
   */
  applyInlineFormat(tag: "strong" | "em" | "del" | "ins"): boolean {
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    let range: Range;
    let anchorNode: Node | null;
    if (sel && sel.rangeCount > 0 && sel.anchorNode !== null) {
      range = sel.getRangeAt(0);
      anchorNode = sel.anchorNode;
    } else if (
      this.dragRange !== null &&
      this.dragRange.startContainer.isConnected
    ) {
      range = this.dragRange.cloneRange();
      anchorNode = range.startContainer;
    } else {
      return false;
    }
    const anchorEl =
      anchorNode instanceof Element
        ? anchorNode
        : (anchorNode?.parentElement ?? null);
    const block = anchorEl?.closest("[data-block-index]") as HTMLElement | null;
    if (!block || block.tagName !== "P" || !block.isConnected) return false;

    const synonyms: Record<string, string[]> = {
      strong: ["STRONG", "B"],
      em: ["EM", "I"],
      del: ["DEL", "S", "STRIKE"],
      ins: ["INS", "U"],
    };
    const tags = synonyms[tag] ?? [];
    let n: Node | null =
      this.firstPositionNodeInRange(range) ?? anchorNode ?? null;
    while (n && n !== block) {
      if (n instanceof Element && tags.includes(n.tagName)) {
        // Toggle off: unwrap the existing format element.
        n.replaceWith(...Array.from(n.childNodes));
        this.syncFromDom();
        this.emitChange();
        return true;
      }
      n = n.parentNode;
    }
    if (range.collapsed) return false;
    const wrap = document.createElement(tag);
    try {
      wrap.appendChild(range.extractContents());
      range.insertNode(wrap);
      if (sel) {
        const after = document.createRange();
        after.selectNodeContents(wrap);
        sel.removeAllRanges();
        sel.addRange(after);
      }
    } catch {
      return false;
    }
    this.syncFromDom();
    this.emitChange();
    return true;
  }

  /**
   * Insert an empty equation block after the caret's block (the
   * insert group's equation button).
   */
  insertMath(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(at, 0, {
      kind: "math",
      text: "E = mc^2",
    });
    this.render();
    this.emitChange();
  }

  /**
   * Toggle the caret's block between prose and a fenced code block
   * (the toolbar's code button in document view).
   */
  toggleCodeBlock(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (!block) return;
    if (block.kind === "prose") {
      this.doc.blocks[idx] = { kind: "code", text: block.text };
      this.render();
      this.emitChange();
      this.focusBlockStart(idx);
    } else if (block.kind === "code") {
      this.doc.blocks[idx] = { kind: "prose", text: block.text };
      this.render();
      this.emitChange();
      this.focusBlockStart(idx);
    }
  }

  /** Re-rendering loses the caret; put it back at the block start. */
  private focusBlockStart(idx: number, atEnd = false): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const child = (host?.children[idx] ?? null) as HTMLElement | null;
    // A code figure's caret belongs in its body, not its header.
    const el =
      child?.querySelector<HTMLElement>("pre.folio-code > code") ?? child;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(!atEnd);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /**
   * The block index at the caret: the shadow selection's anchor
   * (Chromium), or the last clicked block (tracked via shadow-root
   * hit testing, which pierces in every engine).
   */
  private blockIndexAtCaret(): number {
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    let n: Node | null = root?.getSelection?.()?.anchorNode ?? null;
    while (n !== null && !(n instanceof HTMLElement)) {
      n = n.parentNode;
    }
    let el: HTMLElement | null =
      n instanceof HTMLElement
        ? (n.closest("[data-block-index]") as HTMLElement | null)
        : null;
    if (el === null) el = this.lastBlock;
    return Number(el?.dataset.blockIndex ?? -1);
  }

  insertTable(): void {
    if (!this.doc) return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return;
    const sel = window.getSelection();
    let idx = this.doc.blocks.length;
    if (sel && sel.rangeCount > 0 && host.contains(sel.anchorNode)) {
      let node: Node | null = sel.anchorNode;
      while (node && node.parentNode !== host) {
        node = node.parentNode;
      }
      if (node instanceof HTMLElement && node.dataset.blockIndex) {
        idx = Number(node.dataset.blockIndex) + 1;
      }
    }
    this.doc.blocks.splice(idx, 0, {
      kind: "table",
      table: {
        id: `table-${String(Date.now().toString(36))}`,
        columns: [
          { name: "item", type: "text" },
          { name: "value", type: "number" },
        ],
        rows: [
          ["", ""],
          ["", ""],
        ],
      },
    });
    this.render();
    this.emitChange();
  }

  private handleKeydown(ev: KeyboardEvent): void {
    if (!this.doc) return;
    // The inspector's inputs own their keystrokes.
    if (ev.target instanceof Element && ev.target.closest(".folio-inspector")) {
      return;
    }
    // Undo/redo (spec: docs/specs/undo-redo.md). The Markdown
    // textarea lives outside the shadow root, so its native undo
    // is untouched; inspector inputs keep their per-field undo
    // via the guard above.
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      const key = ev.key.toLowerCase();
      if (key === "z" && !ev.shiftKey) {
        ev.preventDefault();
        this.undo();
        return;
      }
      if ((key === "z" && ev.shiftKey) || key === "y") {
        ev.preventDefault();
        this.redo();
        return;
      }
    }
    const removableFigure =
      ev.target instanceof Element
        ? (ev.target.closest(
            "figure.folio-diagram, figure.folio-image, figure.folio-audio",
          ) as HTMLElement | null)
        : null;
    if (
      removableFigure &&
      (ev.key === "Backspace" || ev.key === "Delete") &&
      this.doc
    ) {
      ev.preventDefault();
      const idx = Number(removableFigure.dataset.blockIndex ?? -1);
      if (idx >= 0) {
        this.doc.blocks.splice(idx, 1);
        this.render();
        this.emitChange("delete");
      }
      return;
    }
    if (ev.key === "Backspace" && this.removeEmptyCodeBlock()) {
      ev.preventDefault();
      return;
    }
    // A header-name rename owns its Enter/Tab/Escape/Ctrl+A;
    // every other keystroke passes through so typing edits the
    // name natively.
    const headerName = this.resolveHeaderName(ev.target);
    if (headerName) {
      this.handleHeaderKeys(ev, headerName);
      return;
    }
    const cell = this.resolveCell(ev.target);
    if (cell) {
      // Ctrl/Cmd+A with the caret in a cell selects the CELL, not the
      // whole article: the article is the browser's editing host, and
      // a document-wide select-all from a cell risks replacing the
      // entire document with the next keystroke.
      if (ev.key.toLowerCase() === "a" && (ev.ctrlKey || ev.metaKey)) {
        // Select the cell via the shadow root's selection only: the
        // document-level selection cannot write ranges inside the
        // shadow tree, and on WebKitGTK doing so corrupts the caret
        // and sends typed text into the light DOM. Where no shadow
        // selection exists, select-all stays inert rather than
        // destructive.
        ev.preventDefault();
        const root = this.shadowRoot as
          | (ShadowRoot & {
              getSelection?: () => Selection | null;
            })
          | null;
        const sel = root?.getSelection?.();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(cell);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      this.handleTableNav(ev, cell);
      return;
    }
    if (ev.key !== "Enter") return;
    let idx = -1;
    if (ev.target instanceof Element) {
      const el = ev.target.closest("[data-block-index]") as HTMLElement | null;
      idx = Number(el?.dataset.blockIndex ?? -1);
    }
    // Engines put keydown focus on the article; resolve the block
    // from the caret (or the last clicked block) instead.
    if (idx < 0) idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (!block) return;
    if (block.kind === "table" || block.kind === "chart") return;
    if (block.kind === "math") {
      // Math blocks are generated output; never split into one.
      if (
        ev.target instanceof Element &&
        ev.target.closest("figure.folio-math")
      ) {
        ev.preventDefault();
      }
      return;
    }
    if (block.kind === "diagram") {
      // Never split into a selected diagram.
      if (
        ev.target instanceof Element &&
        ev.target.closest("figure.folio-diagram")
      ) {
        ev.preventDefault();
      }
      return;
    }
    if (block.kind === "code") {
      // A line break inside the code block, not a block split.
      // syncFromDom reads code blocks via innerText so the inserted
      // <br> becomes a real newline in the model.
      ev.preventDefault();
      document.execCommand("insertLineBreak");
      this.syncFromDom();
      this.emitChange();
      return;
    }
    // Prose and headings: let the engine handle Enter natively -
    // the caret lands on the new line in every engine, exactly like
    // a word processor - and the structural sync rebuilds the model
    // from the DOM on the input event. The old model-split +
    // re-render path destroyed the caret, which is why typing
    // after Enter needed a click first.
  }

  /**
   * The header-name span a keyboard event applies to. Same
   * resolution ladder as cells: the event target, the caret through
   * the shadow root's selection (Chromium), then the last focused
   * name span while focus is still inside the component (WebKitGTK
   * has no selection API that pierces the shadow root). A caret
   * inside a data cell is explicitly NOT a header rename.
   */
  private resolveHeaderName(target: EventTarget | null): HTMLElement | null {
    if (target instanceof Element) {
      const span = target.closest("thead th .name") as HTMLElement | null;
      if (span) return span;
    }
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    if (sel && sel.anchorNode !== null) {
      let n: Node | null = sel.anchorNode;
      while (n !== null) {
        if (n instanceof Element) {
          const span = n.closest("thead th .name") as HTMLElement | null;
          if (span) return span;
          if (n.closest("td[data-row-index]") !== null) return null;
        }
        n = n.parentNode;
      }
    }
    if (
      this.lastHeaderName !== null &&
      this.shadowRoot?.contains(this.lastHeaderName) === true &&
      this.shadowRoot?.activeElement !== null
    ) {
      if (
        this.lastBlock !== null &&
        !this.lastBlock.contains(this.lastHeaderName)
      ) {
        this.lastHeaderName = null;
        return null;
      }
      return this.lastHeaderName;
    }
    return null;
  }

  /**
   * Keys while the caret is in a header name (the in-place rename,
   * spec: docs/specs/table-inspector.md): Enter commits and drops
   * into the column's first editable cell; Tab commits and moves to
   * the next header (past the last, into the first editable cell);
   * Escape reverts; Ctrl+A selects the name, never the document.
   */
  private handleHeaderKeys(ev: KeyboardEvent, span: HTMLElement): void {
    const th = span.closest("th");
    const figure = span.closest("figure");
    const ci = Number(th?.dataset.colIndex ?? -1);
    const idx = Number(figure?.dataset.blockIndex ?? -1);
    const block = this.doc?.blocks[idx];
    if (!th || !figure || !block || block.kind !== "table") return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      const col = block.table.columns[ci];
      if (col) span.textContent = col.name;
      return;
    }
    if (ev.key.toLowerCase() === "a" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      const root = this.shadowRoot as
        | (ShadowRoot & {
            getSelection?: () => Selection | null;
          })
        | null;
      const sel = root?.getSelection?.();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }
    if (ev.key !== "Enter" && ev.key !== "Tab") return;
    if (ev.key === "Tab" && ev.shiftKey && th.previousElementSibling === null) {
      // Before the first header: commit, and leave focus movement to
      // the browser exactly as cell navigation does.
      this.commitHeaderRename(span, figure, block, ci);
      return;
    }
    ev.preventDefault();
    this.commitHeaderRename(span, figure, block, ci);
    if (!this.caretFollowsFocus()) return;
    const editable = block.table.columns
      .map((c, i) => (c.type !== "formula" ? i : -1))
      .filter((i) => i >= 0);
    if (ev.key === "Enter") {
      const target = editable.includes(ci) ? ci : (editable[0] ?? -1);
      if (target >= 0) this.focusCell(idx, 0, target);
      return;
    }
    if (th.nextElementSibling === null) {
      if (editable.length > 0) this.focusCell(idx, 0, editable[0] ?? 0);
      return;
    }
    const nextTh = th.nextElementSibling as HTMLElement | null;
    const nextName = ev.shiftKey
      ? (th.previousElementSibling as HTMLElement | null)
      : nextTh;
    (nextName?.querySelector("span.name") as HTMLElement | null)?.focus();
  }

  /**
   * Commit an in-place header rename: a model write, exactly like
   * an inspector edit. Charts that select or sort by the old name
   * follow the rename; formula expressions are free Jexl text and
   * do not - a rename that orphans a formula reference surfaces as
   * the table's error line (guarded render), never a crash.
   */
  private commitHeaderRename(
    span: HTMLElement,
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    ci: number,
  ): void {
    const col = block.table.columns[ci];
    if (!col) return;
    const text = (span.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text === "") {
      // A column must keep a name: revert rather than commit "".
      if (span.textContent !== col.name) span.textContent = col.name;
      return;
    }
    if (text === col.name) return;
    const old = col.name;
    col.name = text;
    for (const b of this.doc?.blocks ?? []) {
      if (b.kind !== "chart" || b.chart.source !== block.table.id) continue;
      b.chart.query.select = b.chart.query.select.map((s) =>
        s === old ? text : s,
      );
      if (b.chart.query.sort && b.chart.query.sort.by === old) {
        b.chart.query.sort.by = text;
      }
    }
    const opt = figure.querySelector<HTMLElement>(
      `.insp-col option[value="${String(ci)}"]`,
    );
    if (opt) opt.textContent = text;
    try {
      this.updateRowCalculations(figure, block);
    } catch {
      // A formula still references the old name: the guarded
      // re-render shows the error line instead of leaving the
      // table's cells half-updated.
      this.refreshTableBlock(figure, block);
    }
    this.emitChange();
  }

  /**
   * Keyboard navigation inside tables (spec: docs/specs/
   * table-keyboard.md): Tab/Shift+Tab move across editable cells
   * (formula columns are skipped), Enter moves down a row; both grow
   * the table when moving past the last row. Commits the current
   * cell (and recalculates formulas) before moving.
   */
  private handleTableNav(ev: KeyboardEvent, td: HTMLTableCellElement): void {
    if (ev.key !== "Tab" && ev.key !== "Enter") return;
    const figure = td.closest("figure") as HTMLElement | null;
    if (!figure) return;
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const block = this.doc?.blocks[idx];
    if (!block || block.kind !== "table") return;
    const cols = block.table.columns;
    const editable = cols
      .map((c, i) => (c.type !== "formula" ? i : -1))
      .filter((i) => i >= 0);
    if (editable.length === 0) return;
    ev.preventDefault();
    this.commitCell(td, block);
    let r = Number(td.dataset.rowIndex);
    let c = Number(td.dataset.colIndex);
    let needsRender = false;
    if (ev.key === "Enter") {
      if (ev.shiftKey) {
        r = Math.max(0, r - 1);
      } else {
        r += 1;
        if (r >= block.table.rows.length) {
          block.table.rows.push(cols.map(() => ""));
          needsRender = true;
        }
      }
    } else if (ev.shiftKey) {
      const prev = editable.filter((i) => i < c);
      if (prev.length > 0) {
        c = prev[prev.length - 1] ?? 0;
      } else {
        const prevRow = r - 1;
        if (prevRow < 0) return; // leave focus movement to the browser
        r = prevRow;
        c = editable[editable.length - 1] ?? 0;
      }
    } else {
      const next = editable.filter((i) => i > c);
      if (next.length > 0) {
        c = next[0] ?? 0;
      } else {
        const nextRow = r + 1;
        if (nextRow >= block.table.rows.length) {
          block.table.rows.push(cols.map(() => ""));
          needsRender = true;
        }
        r = nextRow;
        c = editable[0] ?? 0;
      }
    }
    if (needsRender) {
      const host = figure.parentElement;
      this.refreshTableBlock(
        (host?.querySelector(
          `figure[data-block-index="${String(idx)}"]`,
        ) as HTMLElement | null) ?? null,
        block,
      );
      this.emitChange();
    }
    if (!this.caretFollowsFocus()) {
      // WebKitGTK: JavaScript cannot move the caret into a cell - no
      // selection API pierces the shadow root and focus does not
      // carry the caret. Tab/Enter commit the cell (recalculating
      // formulas, growing the table at the edges) and keep the caret
      // in place; the user clicks the next cell. Moving focus without
      // the caret would send typed text into the wrong cell or
      // nowhere at all.
      return;
    }
    this.focusCell(idx, r, c);
  }

  /**
   * Whether focusing a cell also moves the caret into it (so typing
   * after Tab/Enter lands in the focused cell). True in Chromium;
   * false in WebKitGTK.
   */
  private caretFollowsFocus(): boolean {
    return (
      typeof (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection === "function"
    );
  }

  private focusCell(idx: number, r: number, c: number): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const figure = host?.children[idx] as HTMLElement | undefined;
    const cell = figure?.querySelector(
      `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
    ) as HTMLTableCellElement | null;
    cell?.focus();
  }

  /**
   * The toolbar's link button (spec: docs/specs/links.md). With
   * the caret in a link it opens the link menu to CHANGE it; with
   * a selection it links that text (the menu follows, to set the
   * URL); with a bare caret it inserts a link template. Returns
   * false when there is no prose context (the host flashes).
   */
  linkButtonAction(): boolean {
    if (!this.doc) return false;
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && sel.anchorNode !== null) {
      range = sel.getRangeAt(0);
    } else if (
      this.dragRange !== null &&
      this.dragRange.startContainer.isConnected
    ) {
      range = this.dragRange.cloneRange();
    }
    if (range === null) return false;
    const n = this.firstPositionNodeInRange(range) ?? range.startContainer;
    const el = n instanceof Element ? n : (n?.parentElement ?? null);
    const block = el?.closest("[data-block-index]") as HTMLElement | null;
    if (!block || block.tagName !== "P" || !block.isConnected) return false;
    const existing = (el as Element).closest?.(
      "a[href]",
    ) as HTMLAnchorElement | null;
    if (existing) {
      this.openLinkMenu(existing);
      return true;
    }
    // Wrap the selection (or insert a template) as a link.
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "url");
    if (range.collapsed) {
      anchor.textContent = "link text";
      range.insertNode(anchor);
    } else {
      try {
        range.surroundContents(anchor);
      } catch {
        anchor.textContent = String(range);
        range.insertNode(anchor);
      }
    }
    this.syncFromDom();
    this.emitChange();
    this.openLinkMenu(anchor);
    return true;
  }

  /**
   * The link control (spec: docs/specs/links.md): a floating bar
   * anchored under the link - label and URL editable, Apply writes
   * the DOM (then structural sync derives the source), Remove
   * unwraps. Any click outside (or Esc) closes it.
   */
  private openLinkMenu(anchor: HTMLAnchorElement): void {
    this.closeMenu();
    const root = this.shadowRoot;
    if (!root || !anchor.isConnected) return;
    const menu = document.createElement("div");
    menu.className = "folio-menu folio-link-menu";
    menu.contentEditable = "false";

    const labelInp = document.createElement("input");
    labelInp.className = "link-label";
    labelInp.type = "text";
    labelInp.placeholder = "link text";
    labelInp.value = anchor.textContent ?? "";
    const urlInp = document.createElement("input");
    urlInp.className = "link-url";
    urlInp.type = "text";
    urlInp.placeholder = "url or document path";
    urlInp.value = anchor.getAttribute("href") ?? "";

    const apply = (): void => {
      const href = urlInp.value.trim();
      if (href !== "") anchor.setAttribute("href", href);
      const label = labelInp.value;
      if (label !== (anchor.textContent ?? "")) {
        anchor.textContent = label;
      }
      this.syncFromDom();
      this.emitChange();
      this.closeMenu();
    };
    for (const inp of [labelInp, urlInp]) {
      inp.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          apply();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          this.closeMenu();
        }
      });
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-remove";
    remove.textContent = "Remove link";
    remove.addEventListener("click", () => {
      anchor.replaceWith(...Array.from(anchor.childNodes));
      this.syncFromDom();
      this.emitChange();
      this.closeMenu();
    });

    const done = document.createElement("button");
    done.type = "button";
    done.className = "link-apply";
    done.textContent = "Apply";
    done.addEventListener("click", apply);

    menu.append(labelInp, urlInp, remove, done);
    root.appendChild(menu);
    this.menu = menu;
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + 6 + window.scrollY}px`;
    document.addEventListener("pointerdown", this.menuCloser, {
      once: true,
    });
    (labelInp.value === "" ? urlInp : labelInp).focus();
  }

  private handleContextMenu(ev: MouseEvent): void {
    const cell = (ev.target as HTMLElement).closest(
      "td[data-row-index], th[data-col-index]",
    ) as HTMLElement | null;
    if (!cell || !this.doc) return;
    ev.preventDefault();
    const figure = cell.closest("figure") as HTMLElement | null;
    if (!figure) return;
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    const tr = cell.closest("tr") as HTMLTableRowElement | null;
    const rowIndex = tr ? Number(tr.dataset.rowIndex ?? 0) : 0;
    const colIndex =
      cell.tagName === "TH"
        ? Number(cell.dataset.colIndex ?? 0)
        : Number(cell.dataset.colIndex ?? 0);
    this.showMenu(ev.clientX, ev.clientY, block, rowIndex, colIndex, figure);
  }

  private showMenu(
    x: number,
    y: number,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    r: number,
    c: number,
    figure: HTMLElement,
  ): void {
    this.closeMenu();
    const root = this.shadowRoot;
    if (!root) return;
    const menu = document.createElement("div");
    menu.className = "folio-menu";
    const items: [string, () => void][] = [
      [
        "Insert row below",
        () => {
          block.table.rows.splice(
            r + 1,
            0,
            block.table.columns.map(() => ""),
          );
        },
      ],
      [
        "Delete row",
        () => {
          block.table.rows.splice(r, 1);
        },
      ],
      [
        "Insert column right",
        () => {
          block.table.columns.splice(c + 1, 0, {
            name: "new",
            type: "text",
          });
          block.table.rows.forEach((row) => row.splice(c + 1, 0, ""));
        },
      ],
      [
        "Delete column",
        () => {
          const col = block.table.columns[c];
          if (col && col.type === "formula") return;
          block.table.columns.splice(c, 1);
          block.table.rows.forEach((row) => row.splice(c, 1));
        },
      ],
    ];
    for (const [label, action] of items) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        action();
        this.closeMenu();
        this.refreshTableBlock(figure, block);
        this.emitChange();
      });
      menu.appendChild(btn);
    }
    const hostRect = this.getBoundingClientRect();
    menu.style.left = `${String(x - hostRect.left)}px`;
    menu.style.top = `${String(y - hostRect.top)}px`;
    const host = root.querySelector("article.folio-doc");
    if (host) host.appendChild(menu);
    this.menu = menu;
    setTimeout(() => {
      document.addEventListener("pointerdown", this.menuCloser, {
        once: true,
      });
    });
  }

  private menuCloser = (ev: Event): void => {
    if (ev.composedPath().includes(this.menu ?? ({} as HTMLElement))) return;
    this.closeMenu();
  };

  private closeMenu(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }
}

customElements.define("folio-doc", FolioDoc);

declare global {
  interface HTMLElementTagNameMap {
    "folio-doc": FolioDoc;
  }
}
