/**
 * <folio-doc>: the embeddable document component (ADR-0006).
 * One contenteditable surface for the whole document (seamless
 * WYSIWYG); the model is synced from the DOM, never the reverse
 * during typing. Full re-render happens only on structural ops.
 * Row/column operations live in a context menu, not on the page.
 */
import type { Footnote } from "./engine/doc.js";
import { headingSlug } from "./engine/outline.js";
import {
  parseDoc,
  serializeDoc,
  type Doc,
  type DocBlock,
  type ListBody,
} from "@folio/engine/doc";
import { outlineOf, type OutlineEntry } from "@folio/engine/outline";
import {
  recalcTable,
  type RecalcMemo,
  type TablePool,
} from "@folio/engine/recalc";
import type { Audio, Cell, Chart, Image, Table } from "@folio/engine/index.js";
import { executeQuery, filterIndexes, sortIndexes } from "@folio/engine/query";
import type { StrudelRepl } from "@strudel/web";
import {
  STRUDEL_SIZE,
  installStrudel,
  loadStrudel,
  strudelIfLoaded,
  strudelInstalled,
} from "./audio/strudel-addon.js";
import { CODE_LANGUAGES, paintCode, tokenizeCode } from "./render/code.js";
import { DRUM_KIT, drumKitUrls } from "./audio/drum-kit.js";
import { onlineSampleSources } from "./audio/online-samples.js";
import { notesFromAbc, playNotes, type Playback } from "./audio/tone-synth.js";
import { themeFromDoc, themeCss, type Mode } from "./render/theme.js";
import { registerFonts } from "./render/fonts.js";
import { formatComputed } from "./render/number.js";
import { meshToSvg, VIEWS, type MeshPolygon } from "./render/mesh-svg.js";
import { meshToStl } from "./render/stl.js";
import { sanitizeSvg } from "./render/svg-sanitize.js";
import { bindVegaData, vegaDataRefs } from "./render/vega-data.js";
import {
  renderAreaChart,
  renderBarChart,
  renderLineChart,
  renderPieChart,
  renderScatterChart,
  renderSeriesChart,
  type ChartStyle,
} from "./render/chart.js";
import { chartSeries } from "@folio/engine/series";
import {
  inlineMarkdownToHtml,
  htmlToInlineMarkdown,
  type InlineOptions,
} from "./render/inline.js";
import { parseBibtex, type Bibliography } from "./engine/bibtex.js";
import { toIso } from "./engine/dates.js";
import {
  citedKeys,
  formatBibliography,
  formatCitation,
  parseCitation,
  runsText,
  type Cluster,
  type Formatted,
  type Run,
} from "./engine/citations.js";

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

/** A plain number as people type it in a table (1,234.50, -3, .5). */
const NUMERIC_RE = /^-?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?$/;

/**
 * Tab, however the engine names it: WebKitGTK reports Shift+Tab (GTK's
 * ISO_Left_Tab) as key "Unidentified" - only `code` says "Tab" - so a
 * key-only check made Shift+Tab dead in the desktop app.
 */
function isTabKey(ev: KeyboardEvent): boolean {
  return ev.key === "Tab" || ev.code === "Tab";
}

/** A list body as nested <ul>/<ol> (spec: docs/specs/lists.md). */
function renderListBody(body: ListBody, opts: InlineOptions = {}): HTMLElement {
  const el = document.createElement(body.ordered ? "ol" : "ul");
  if (body.ordered && body.start !== undefined) {
    (el as HTMLOListElement).start = body.start;
  }
  for (const item of body.items.length > 0 ? body.items : [{ text: "" }]) {
    const li = document.createElement("li");
    li.innerHTML = inlineMarkdownToHtml(item.text, opts);
    if (item.children) li.appendChild(renderListBody(item.children, opts));
    el.appendChild(li);
  }
  return el;
}

/**
 * Read a <ul>/<ol> back into the model: each <li>'s own text (its
 * nested lists excluded) and its sub-list. A list placed DIRECTLY in
 * a list (some engines' native indent) belongs to the item before it.
 */
function readListBody(el: Element): ListBody {
  const body: ListBody = { ordered: el.tagName === "OL", items: [] };
  const start = (el as HTMLOListElement).start;
  if (body.ordered && start !== 1) body.start = start;
  for (const child of Array.from(el.children)) {
    if (child.tagName === "LI") {
      const own = child.cloneNode(true) as Element;
      for (const sub of Array.from(own.children)) {
        if (sub.tagName === "UL" || sub.tagName === "OL") sub.remove();
      }
      const sub = Array.from(child.children).find(
        (c) => c.tagName === "UL" || c.tagName === "OL",
      );
      body.items.push({
        text: htmlToInlineMarkdown(own.innerHTML).replace(/\n+$/, ""),
        ...(sub ? { children: readListBody(sub) } : {}),
      });
    } else if (child.tagName === "UL" || child.tagName === "OL") {
      const prev = body.items[body.items.length - 1];
      if (prev) prev.children = readListBody(child);
    }
  }
  return body;
}

/** Turn a <ul> into an <ol> (or back), keeping its items. */
function swapListTag(list: HTMLElement, tag: "UL" | "OL"): HTMLElement {
  const next = document.createElement(tag.toLowerCase());
  next.append(...Array.from(list.childNodes));
  list.replaceWith(next);
  return next;
}

/** Every item's text, depth first (a list unlisted into paragraphs). */
function flattenList(body: ListBody): string[] {
  return body.items.flatMap((i) => [
    i.text,
    ...(i.children ? flattenList(i.children) : []),
  ]);
}

/** Blend two #rrggbb colours: `t` of the way from `a` to `b`. */
function mixHex(a: string, b: string, t: number): string {
  const rgb = (h: string): number[] =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return (
    "#" +
    x
      .map((v, i) =>
        Math.round(v + ((y[i] ?? v) - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * Code languages whose block is DRAWN (spec: docs/specs/
 * drawn-blocks.md): the figure is the picture, the code shows on
 * click. Value: the picture's accessible name.
 */
const DRAWN_LANGS: Record<string, string> = {
  jscad: "3D model",
  dot: "Graphviz diagram",
  graphviz: "Graphviz diagram",
  "vega-lite": "Vega-Lite chart",
  svg: "SVG drawing",
  abc: "Sheet music",
  bibtex: "References",
  biblatex: "References",
};

/** "Personal use only" - on a table or chart whose data's terms do not
 * allow sharing (docs/specs/data-import.md). */
function personalMark(after: boolean): HTMLElement {
  const mark = document.createElement("span");
  mark.className = "folio-personal";
  mark.textContent = `${after ? " · " : ""}Personal use only - not for sharing`;
  mark.title =
    "Imported under terms that do not allow sharing this data, or figures derived from it";
  return mark;
}

/** A bibliography block (docs/specs/citations.md). */
/** Edits to a table's shape (context menu, palette). */
export type TableAction =
  "row-below" | "delete-row" | "column-right" | "delete-column";

function isBibLang(lang: string | undefined): boolean {
  return lang === "bibtex" || lang === "biblatex";
}

/** The bibliography's starting entry: a real one, to show the shape. */
const BIBTEX_STARTER = `% An example entry. Paste your own BibTeX here - it replaces this.
@article{knuth1984,
  author  = {Knuth, Donald E.},
  title   = {Literate Programming},
  journal = {The Computer Journal},
  volume  = {27},
  number  = {2},
  pages   = {97--111},
  year    = {1984},
  doi     = {10.1093/comjnl/27.2.97}
}`;

function isDrawnLang(lang: string | undefined): boolean {
  return lang !== undefined && lang in DRAWN_LANGS;
}

const ABC_STARTER = `X:1
T:A small tune
M:4/4
L:1/8
Q:1/4=110
K:G
GABc d2 B2 | c2 A2 B4 | ABcd e2 c2 | B2 G2 G4 |]`;

const SVG_STARTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240">
  <rect x="10" y="10" width="220" height="100" rx="12"
        fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="70" cy="60" r="28" fill="var(--folio-accent)"/>
  <text x="115" y="66" font-size="18" fill="currentColor">Hello</text>
</svg>`;

const VEGA_STARTER = `{
  "data": { "values": [
    { "item": "A", "value": 28 },
    { "item": "B", "value": 55 },
    { "item": "C", "value": 43 }
  ] },
  "mark": "bar",
  "encoding": {
    "x": { "field": "item", "type": "nominal" },
    "y": { "field": "value", "type": "quantitative" }
  }
}`;

const GRAPHVIZ_STARTER = `digraph {
  rankdir=LR
  draft -> review -> publish
  review -> draft [label="changes"]
}`;

/** A JSCAD script that runs longer than this is stopped (ADR-0020). */
const JSCAD_TIMEOUT_MS = 5000;

const JSCAD_STARTER = `const { cuboid, cylinder } = require('@jscad/modeling').primitives
const { subtract } = require('@jscad/modeling').booleans

const main = () => subtract(
  cuboid({ size: [40, 30, 10] }),
  cylinder({ radius: 8, height: 12, segments: 48 })
)

module.exports = { main }`;

/**
 * The caret's position as a count of characters from the start of
 * `root` (a <br> counts as one, a newline): survives rebuilding the
 * text as a single node.
 */
function textOffsetIn(root: Node, node: Node, offset: number): number {
  let count = 0;
  const target =
    node.nodeType === Node.TEXT_NODE ? node : (node.childNodes[offset] ?? null);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === target) {
      return n.nodeType === Node.TEXT_NODE ? count + offset : count;
    }
    if (n.nodeType === Node.TEXT_NODE) count += (n.textContent ?? "").length;
    else if ((n as Element).tagName === "BR") count += 1;
  }
  return count;
}

/** The element that scrolls `el` (the page, or a scrolling host). */
function scrollContainerOf(el: Element): Element {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) {
      return n;
    }
  }
  return document.scrollingElement ?? document.documentElement;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c,
  );
}

/** A figure-bar control with a visible label (its accessible name). */
function labelled(text: string, control: HTMLElement): HTMLElement {
  const label = document.createElement("label");
  label.className = "insp-field";
  const span = document.createElement("span");
  span.className = "insp-label";
  span.textContent = text;
  label.append(span, control);
  return label;
}

/** Blocks whose text is inline Markdown: formats and links apply. */
const INLINE_BLOCKS = new Set(["P", "UL", "OL"]);

/** Undo grouping: same-label changes within this window are one step. */
const COALESCE_MS = 600;
/** Two changes this close are one user action, whatever their labels. */
const ACTION_MS = 100;
/** The undo stack's ceiling. */
const HISTORY_MAX = 100;

/** The smallest a table's type shrinks to fit its page. */
const TABLE_FIT_MIN = 0.75;

/**
 * Fit a table to its page (spec: docs/specs/table-layout.md): a table
 * wider than the column shrinks its type (and, in em, its padding)
 * until it fits - down to 75%; past that it scrolls sideways. Wide
 * tables with tracked caps or eight columns overflowed in most themes,
 * and a printout clipped them. Re-fits whenever the page or the table
 * changes size.
 */
function fitTable(scroller: HTMLElement, table: HTMLElement): void {
  let fitting = false;
  const fit = (): void => {
    if (fitting || !scroller.isConnected) return;
    fitting = true;
    table.style.fontSize = "";
    const avail = scroller.clientWidth;
    let k = 1;
    // Two passes: padding and borders do not scale exactly with type.
    for (let i = 0; i < 3 && avail > 0 && table.scrollWidth > avail + 1; i++) {
      k = Math.max(TABLE_FIT_MIN, (k * avail) / table.scrollWidth);
      table.style.fontSize = `${k.toFixed(3)}em`;
      if (k === TABLE_FIT_MIN) break;
    }
    table.dataset.fit = k < 1 ? k.toFixed(2) : "";
    fitting = false;
  };
  const ro = new ResizeObserver(() => requestAnimationFrame(fit));
  ro.observe(scroller);
  ro.observe(table);
}

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
  /** The block the caret was last seen in (typed atoms hydrate on leaving it). */
  private caretBlock: HTMLElement | null = null;
  /**
   * The last mouse-drag text selection, built from the two caret
   * points (document.caretRangeFromPoint pierces the shadow tree
   * in every engine). WebKitGTK exposes no selection API that
   * pierces the shadow root, so without this the inline format
   * buttons could not resolve any selection there at all.
   */
  private dragRange: Range | null = null;
  private dragStart: { x: number; y: number } | null = null;
  /** Online sample sources the user allowed this session (ADR-0019). */
  private allowedSampleSources = new Set<string>();
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

  /**
   * The caret's block, tracked on EVERY selection change: commands
   * that move focus out of the document (the palette) still act on
   * the block the caret was in - not the last block clicked.
   */
  private trackCaret = (): void => {
    let n: Node | null = this.caretPoint()?.node ?? null;
    while (n !== null && !(n instanceof HTMLElement)) n = n.parentNode;
    const block =
      n instanceof HTMLElement
        ? (n.closest(
            "article.folio-doc > [data-block-index]",
          ) as HTMLElement | null)
        : null;
    if (block) this.lastBlock = block;
    // The caret left a cell that was typed in: recalculate now.
    if (
      this.pendingCell &&
      (!(n instanceof HTMLElement) || n.closest("td") !== this.pendingCell.td)
    ) {
      this.flushPendingRecalc();
    }
    // (Its own record: a mousedown moves lastBlock before this runs.)
    const left = this.caretBlock;
    if (block) this.caretBlock = block;
    if (left && block && left !== block) this.hydrateInline(left);
    const li = n instanceof HTMLElement ? n.closest("li") : null;
    this.lastLi = li && block?.contains(li) ? li : block ? null : this.lastLi;
  };

  /**
   * A paragraph the caret just left: citations, cross-references and
   * footnote numbers TYPED in it (`[@knuth1984, p. 99]`) become their
   * atoms now, not on the next reload. The source is unchanged - the
   * atoms convert back to exactly the typed text.
   */
  private hydrateInline(el: HTMLElement): void {
    if (!el.isConnected || el.tagName !== "P" || !this.doc) return;
    const block = this.doc.blocks[Number(el.dataset.blockIndex ?? -1)];
    if (block?.kind !== "prose") return;
    const atoms = "span.folio-cite, a.folio-xref, sup.folio-fnref";
    const html = inlineMarkdownToHtml(block.text, this.inlineOpts());
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    if (
      tpl.content.querySelectorAll(atoms).length <=
      el.querySelectorAll(atoms).length
    ) {
      return;
    }
    el.innerHTML = html;
    const host = el.closest("article.folio-doc");
    if (host) this.renderCrossRefs(host);
  }

  /** The list item the caret is (or was last) in. */
  private lastLi: HTMLElement | null = null;

  /**
   * Hide every open inspector bar except the one in `keep` (the
   * figure the click landed in, if any).
   */
  private dismissInspectors(keep: HTMLElement | null): void {
    for (const bar of Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>(
        ".folio-inspector:not([hidden])",
      ) ?? [],
    )) {
      const owner = bar.closest("figure");
      if (owner === keep) continue;
      bar.hidden = true;
      // Leaving a code block: repaint its syntax colors for the
      // edited text (never while the caret is inside).
      if (owner?.classList.contains("folio-codeblock")) {
        void this.highlightCode(owner as HTMLElement);
      }
    }
  }

  /** A press that lands on nothing INSIDE the shadow tree - the
   * desk around the page (the host element itself), the host's own
   * UI - is "outside" every figure: all bars hide. */
  private outsidePress = (ev: Event): void => {
    const inside = ev
      .composedPath()
      .some((n) => n instanceof Node && n.getRootNode() === this.shadowRoot);
    if (!inside) this.dismissInspectors(null);
  };

  /**
   * Revealing a figure's bar (table, chart, code header ...) pushes
   * the figure down by the bar's height - the table jumped ~50px under
   * the pointer. Scroll by the same height, so what was clicked stays
   * put. Hiding is not compensated: the click went elsewhere, and that
   * spot must not move.
   */
  private barObserver = new MutationObserver((records) => {
    for (const r of records) {
      const bar = r.target as HTMLElement;
      if (
        r.oldValue === null ||
        bar.hidden ||
        !bar.classList.contains("folio-inspector")
      ) {
        continue;
      }
      const style = getComputedStyle(bar);
      if (style.position === "sticky" && bar.getBoundingClientRect().top <= 0) {
        continue;
      }
      const shift =
        bar.getBoundingClientRect().height +
        parseFloat(style.marginTop || "0") +
        parseFloat(style.marginBottom || "0");
      scrollContainerOf(this).scrollBy({ top: shift, behavior: "instant" });
    }
  });

  disconnectedCallback(): void {
    this.barObserver.disconnect();
    document.removeEventListener("selectionchange", this.trackCaret);
    document.removeEventListener("mousedown", this.outsidePress, true);
  }

  connectedCallback(): void {
    document.addEventListener("selectionchange", this.trackCaret);
    if (this.shadowRoot) {
      this.barObserver.observe(this.shadowRoot, {
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden"],
        attributeOldValue: true,
      });
    }
    // Native Enter (e.g. leaving a list) makes <p>, not <div>: the
    // DOM matches what a render would build.
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.addEventListener("mousedown", this.outsidePress, true);
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

  /**
   * The plain text of the section a heading opens (up to the next
   * heading of the same or a higher level) - for searching the help
   * by what it SAYS, not only its titles.
   */
  sectionText(blockIndex: number): string {
    const blocks = this.doc?.blocks ?? [];
    const head = blocks[blockIndex];
    if (head?.kind !== "heading") return "";
    const parts: string[] = [];
    for (let i = blockIndex + 1; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b) break;
      if (b.kind === "heading" && b.level <= head.level) break;
      if (b.kind === "prose" || b.kind === "heading") parts.push(b.text);
      if (b.kind === "list") parts.push(...flattenList(b));
    }
    return parts
      .join(" ")
      .replace(/[`*_[\]()]/g, " ")
      .replace(/\s+/g, " ");
  }

  revealBlock(blockIndex: number): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const el = host?.children[blockIndex] as HTMLElement | undefined;
    if (!host || !el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    this.holdReveal(host, el);
    // The caret follows, to the start of the block (like Word's
    // navigation pane): typing continues there, and the toolbar shows
    // the block it is in. No focus ring - the heading is the
    // destination, not a control.
    (host as HTMLElement).focus({ preventScroll: true });
    if (host.getAttribute("contenteditable") === "true") {
      this.setCaret(el, 0);
    } else {
      el.setAttribute("tabindex", "-1");
      el.classList.add("folio-revealed");
      el.focus({ preventScroll: true });
    }
  }

  private revealHold: (() => void) | undefined;

  /**
   * Keep a revealed block in place while the page settles: figures
   * above it (charts, diagrams, drawings) finish drawing AFTER the
   * jump starts, grow, and pushed the heading hundreds of pixels down.
   * Each resize re-aims the jump; the reader's own scrolling, a key,
   * a click or two seconds end the hold.
   */
  private holdReveal(host: Element, el: HTMLElement): void {
    this.revealHold?.();
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false; // the initial observation is not a change
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const events = ["wheel", "touchstart", "keydown", "pointerdown"];
    const stop = (): void => {
      ro.disconnect();
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, stop, true);
      if (this.revealHold === stop) this.revealHold = undefined;
    };
    const timer = window.setTimeout(stop, 2000);
    for (const e of events)
      window.addEventListener(e, stop, { capture: true, passive: true });
    ro.observe(host);
    this.revealHold = stop;
  }

  /** The last block whose top is inside the window. */
  lastBlockInView(): number {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return -1;
    let last = -1;
    for (let i = 0; i < host.children.length; i++) {
      const r = host.children[i]?.getBoundingClientRect();
      if (r && r.top < window.innerHeight) last = i;
    }
    return last;
  }

  /** Put the caret at the start of the document (a new document's title). */
  focusStart(): void {
    this.focusBlockStart(0);
  }

  /** The first block showing below `viewTop` (a host's sticky bar). */
  firstVisibleBlockIndex(viewTop = 0): number {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return -1;
    const top = Math.max(this.getBoundingClientRect().top, viewTop);
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
    // Captions and references renumber with every change (a figure
    // redrawn by its inspector loses its number otherwise).
    const xhost = this.shadowRoot?.querySelector("article.folio-doc");
    if (xhost) this.renderCrossRefs(xhost);
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
    this.forgetRecalc();
    // A full render replaces every figure: music stops with it
    // (only once the library was ever loaded - never import it
    // for a document that plays nothing).
    if (this.repl !== null) void this.stopStrudel();
    this.stopAbc();
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
      if (this.handleFootnoteClick(ev)) return;
      const cite = (ev.target as Element).closest?.(
        "span.folio-cite",
      ) as HTMLElement | null;
      if (cite) {
        ev.preventDefault();
        const key = parseCitation(cite.dataset.cite ?? "")?.items.find((i) =>
          this.citeFormat?.byKey.has(i.key),
        )?.key;
        const li =
          key &&
          this.shadowRoot?.querySelector<HTMLElement>(
            `ol.folio-refs li[data-key="${CSS.escape(key)}"]`,
          );
        if (li) {
          li.scrollIntoView({ behavior: "smooth", block: "center" });
          li.classList.remove("folio-xref-target");
          void li.offsetWidth;
          li.classList.add("folio-xref-target");
        }
        return;
      }
      const tocLink = (ev.target as Element).closest?.(
        "a.folio-toc-link",
      ) as HTMLElement | null;
      if (tocLink) {
        ev.preventDefault();
        this.revealBlock(Number(tocLink.dataset.target));
        return;
      }
      const xref = (ev.target as Element).closest?.(
        "a.folio-xref",
      ) as HTMLElement | null;
      if (xref) {
        ev.preventDefault();
        const host = this.shadowRoot?.querySelector("article.folio-doc");
        const t =
          host && this.crossRefTargets(host).get(xref.dataset.ref ?? "");
        if (t) {
          t.el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Pick out where the reference landed, as footnotes do.
          t.el.classList.remove("folio-xref-target");
          void (t.el as HTMLElement).offsetWidth;
          t.el.classList.add("folio-xref-target");
        }
        return;
      }
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
        this.dismissInspectors(
          (el?.closest("figure") as HTMLElement | null) ?? null,
        );
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
    this.renderNotes(host, true);
    root.appendChild(host);
    this.renderCrossRefs(host);
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
        el.innerHTML = inlineMarkdownToHtml(block.text, this.inlineOpts());
        return el;
      }
      case "list": {
        // Spec: docs/specs/lists.md. Items are inline Markdown, like
        // a paragraph; editing inside is native (Enter adds an item).
        const el = renderListBody(block, this.inlineOpts());
        el.dataset.blockIndex = String(idx);
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
        // Figures drawn from personal-use data carry its terms too.
        const from = this.doc?.blocks.find(
          (b) => b.kind === "table" && b.table.id === block.chart.source,
        );
        if (from?.kind === "table" && from.table.licence === "personal-use") {
          const note = document.createElement("div");
          note.className = "folio-table-source";
          note.contentEditable = "false";
          note.appendChild(personalMark(false));
          figure.appendChild(note);
        }
        this.drawChart(figure);
        return figure;
      }
      case "toc": {
        // Filled in by renderContents (it needs the whole document).
        const nav = document.createElement("nav");
        nav.className = "folio-toc";
        nav.contentEditable = "false";
        nav.setAttribute("aria-label", "Contents");
        nav.dataset.blockIndex = String(idx);
        return nav;
      }
      case "footnotes": {
        // The definitions stay where the author wrote them in the
        // file; on the page they are gathered into the Notes section
        // at the end (renderNotes), so here the block is a hidden
        // placeholder that keeps the block indexes 1:1.
        const el = document.createElement("aside");
        el.className = "folio-fndefs";
        el.hidden = true;
        el.contentEditable = "false";
        el.dataset.blockIndex = String(idx);
        return el;
      }
      default: {
        const el = document.createElement("p");
        el.dataset.blockIndex = String(idx);
        return el;
      }
    }
  }

  /**
   * Insert a footnote at the caret (spec: docs/specs/footnotes.md): a
   * numbered reference in the text and an empty note at the end, with
   * the caret in the note. Returns why it could not, or null.
   */
  insertFootnote(): string | null {
    if (!this.doc) return "No document";
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const at = this.caretPoint();
    const el =
      at && (at.node instanceof Element ? at.node : at.node.parentElement);
    const block = el?.closest?.("article.folio-doc > p, article.folio-doc li");
    if (!host || !at || !block || el?.closest(".folio-notes")) {
      return "Put the cursor in a paragraph or list item first";
    }
    // The next free label: 1, 2, 3...
    const used = new Set<string>(this.footnoteOrder(host));
    for (const b of this.doc.blocks) {
      if (b.kind === "footnotes") for (const n of b.notes) used.add(n.label);
    }
    let n = 1;
    while (used.has(String(n))) n += 1;
    const label = String(n);
    const tpl = document.createElement("template");
    tpl.innerHTML = inlineMarkdownToHtml(`[^${label}]`);
    const sup = tpl.content.firstChild;
    if (!sup) return "Could not insert the footnote";
    this.plainSpaceBefore(at);
    const range = document.createRange();
    range.setStart(at.node, at.offset);
    range.collapse(true);
    range.insertNode(sup);
    this.syncFromDom();
    // The definition joins a footnote block at the very end, or starts
    // one there - where GitHub-style documents keep their notes.
    const last = this.doc.blocks[this.doc.blocks.length - 1];
    if (last?.kind === "footnotes") last.notes.push({ label, text: "" });
    else
      this.doc.blocks.push({ kind: "footnotes", notes: [{ label, text: "" }] });
    this.render();
    this.emitChange("insert");
    const text = this.shadowRoot?.querySelector<HTMLElement>(
      `section.folio-notes li[data-fn="${CSS.escape(label)}"] .fn-text`,
    );
    if (text) {
      text.scrollIntoView({ behavior: "smooth", block: "center" });
      text.focus();
      this.setCaret(text, 0);
    }
    return null;
  }

  /**
   * Cross-reference targets (spec: docs/specs/cross-references.md):
   * every captioned table and figure is numbered in reading order -
   * "Table 2", "Figure 3" - and so is any uncaptioned one a reference
   * names. Headings are targets by their GitHub-style slug.
   */
  private crossRefTargets(
    host: Element,
  ): Map<string, { label: string; el: Element }> {
    const targets = new Map<string, { label: string; el: Element }>();
    if (!this.doc) return targets;
    const referenced = new Set(
      Array.from(host.querySelectorAll<HTMLElement>("a.folio-xref")).map(
        (a) => a.dataset.ref ?? "",
      ),
    );
    let tables = 0;
    let figures = 0;
    const slugs = new Map<string, number>();
    for (const el of Array.from(host.children)) {
      const idx = Number((el as HTMLElement).dataset.blockIndex ?? -1);
      const block = this.doc.blocks[idx];
      if (!block) continue;
      if (block.kind === "heading") {
        let slug = headingSlug(block.text);
        const seen = slugs.get(slug) ?? 0;
        slugs.set(slug, seen + 1);
        if (seen > 0) slug = `${slug}-${String(seen)}`;
        targets.set(`sec:${slug}`, { label: block.text, el });
        continue;
      }
      let kind: "tbl" | "fig" | null = null;
      let id: string | undefined;
      let caption: string | undefined;
      if (block.kind === "table" && !block.table.simple) {
        kind = "tbl";
        id = block.table.id;
        caption = block.table.caption;
      } else if (block.kind === "chart") {
        kind = "fig";
        id = block.chart.id;
        caption = block.chart.caption;
      } else if (block.kind === "image") {
        kind = "fig";
        id = block.image.id;
        caption = block.image.caption;
      } else if (block.kind === "diagram") {
        kind = "fig";
        id = block.diagram.id;
      }
      if (!kind) continue;
      const named = id !== undefined && referenced.has(`${kind}:${id}`);
      const cap = el.querySelector<HTMLElement>(":scope > figcaption");
      const fig = el as HTMLElement;
      if (!caption && !named) {
        if (cap) delete cap.dataset.label;
        delete fig.dataset.xlabel;
        continue;
      }
      const label =
        kind === "tbl"
          ? `Table ${String(++tables)}`
          : `Figure ${String(++figures)}`;
      if (cap) {
        if (caption) cap.dataset.label = label;
        else delete cap.dataset.label;
      }
      // Referenced but uncaptioned: the number still shows, on its own
      // where a caption would be, so "see Table 2" has a Table 2.
      if (caption && cap) delete fig.dataset.xlabel;
      else fig.dataset.xlabel = label;
      if (id !== undefined) targets.set(`${kind}:${id}`, { label, el });
    }
    return targets;
  }

  /**
   * Fill every table of contents (spec: docs/specs/contents.md): the
   * document's headings, nested by level, each a link that jumps there.
   * A lone H1 is the title, so it is left out; three levels deep.
   */
  private renderContents(host: Element): void {
    if (!this.doc) return;
    const navs = Array.from(
      host.querySelectorAll<HTMLElement>(":scope > nav.folio-toc"),
    );
    if (navs.length === 0) return;
    const heads = this.doc.blocks
      .map((b, i) => ({ b, i }))
      .filter((x) => x.b.kind === "heading") as {
      b: Extract<DocBlock, { kind: "heading" }>;
      i: number;
    }[];
    const h1s = heads.filter((h) => h.b.level === 1).length;
    const top = h1s === 1 ? 2 : 1;
    const shown = heads.filter((h) => h.b.level >= top && h.b.level < top + 3);
    const signature = shown
      .map((h) => `${String(h.i)}:${String(h.b.level)}:${h.b.text}`)
      .join("\n");
    for (const nav of navs) {
      if (nav.dataset.signature === signature) continue;
      nav.dataset.signature = signature;
      nav.textContent = "";
      const title = document.createElement("p");
      title.className = "folio-toc-title";
      title.textContent = "Contents";
      nav.appendChild(title);
      if (shown.length === 0) {
        const empty = document.createElement("p");
        empty.className = "folio-toc-empty";
        empty.textContent = "Headings will be listed here.";
        nav.appendChild(empty);
        continue;
      }
      // Nested lists: a deeper heading opens a list inside the last item.
      const root = document.createElement("ol");
      const stack: { level: number; list: HTMLOListElement }[] = [
        { level: top, list: root },
      ];
      for (const h of shown) {
        let current = stack[stack.length - 1];
        while (current && h.b.level < current.level && stack.length > 1) {
          stack.pop();
          current = stack[stack.length - 1];
        }
        if (current && h.b.level > current.level) {
          const parentItem = current.list.lastElementChild ?? current.list;
          const sub = document.createElement("ol");
          parentItem.appendChild(sub);
          stack.push({ level: h.b.level, list: sub });
          current = stack[stack.length - 1];
        }
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "folio-toc-link";
        a.tabIndex = 0;
        a.dataset.target = String(h.i);
        a.textContent = h.b.text;
        li.appendChild(a);
        current?.list.appendChild(li);
      }
      nav.appendChild(root);
    }
  }

  /** Insert a table of contents after the caret's block (or in place
   * of an empty line). */
  insertContents(): void {
    if (!this.doc) return;
    const { at, replace } = this.insertionPoint(this.blockIndexAtCaret());
    this.doc.blocks.splice(at, replace, { kind: "toc", marker: "[[_TOC_]]" });
    this.render();
    this.emitChange("insert");
    this.shadowRoot
      ?.querySelector(`article.folio-doc > [data-block-index="${String(at)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /** Number the captions and fill in every cross-reference. */
  private renderCrossRefs(host: Element): void {
    this.renderContents(host);
    this.renderCitations(host);
    const targets = this.crossRefTargets(host);
    for (const a of Array.from(
      host.querySelectorAll<HTMLElement>("a.folio-xref"),
    )) {
      const ref = a.dataset.ref ?? "";
      const t = targets.get(ref);
      const kind = ref.split(":")[0];
      const noun =
        kind === "tbl" ? "table" : kind === "fig" ? "figure" : "section";
      a.textContent = t ? t.label : `${noun} ?`;
      a.classList.toggle("folio-xref-missing", !t);
      a.title = t
        ? `Go to ${t.label}`
        : `No ${noun} with the id "${ref.slice(ref.indexOf(":") + 1)}"`;
    }
  }

  /** Every target a reference can name, for the "Cross-reference" picker. */
  crossRefChoices(): { ref: string; label: string; caption: string }[] {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host || !this.doc) return [];
    const out: { ref: string; label: string; caption: string }[] = [];
    // A lone H1 is the document's title - nothing to refer to.
    const h1s = this.doc.blocks.filter(
      (b) => b.kind === "heading" && b.level === 1,
    );
    const title = h1s.length === 1 ? h1s[0] : undefined;
    for (const [ref, t] of this.crossRefTargets(host)) {
      if (ref.startsWith("sec:")) {
        const idx = Number((t.el as HTMLElement).dataset.blockIndex ?? -1);
        if (!t.label.trim() || this.doc.blocks[idx] === title) continue;
      }
      const cap =
        t.el.querySelector(":scope > figcaption")?.textContent?.trim() ?? "";
      out.push({
        ref,
        label: t.label,
        caption: ref.startsWith("sec:") ? "" : cap,
      });
    }
    return out;
  }

  /** Insert `@kind:id` at the caret. Returns why it could not, or null. */
  insertCrossRef(ref: string): string | null {
    return this.insertInlineAtom(`@${ref}`, "a.folio-xref", "reference");
  }

  /**
   * Insert an inline atom (a cross-reference, a citation) written as
   * `markdown` at the caret. Returns why it could not, or null.
   */
  private insertInlineAtom(
    markdown: string,
    selector: string,
    what: string,
  ): string | null {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    let at = this.caretPoint();
    const el =
      at && (at.node instanceof Element ? at.node : at.node.parentElement);
    if (
      !host ||
      !at ||
      !el?.closest?.("article.folio-doc > p, article.folio-doc li")
    ) {
      return "Put the cursor in a paragraph or list item first";
    }
    const tpl = document.createElement("template");
    tpl.innerHTML = inlineMarkdownToHtml(
      ` ${markdown}`,
      this.inlineOpts(),
    ).trimStart();
    const node = tpl.content.querySelector(selector);
    if (!node) return `Could not insert the ${what}`;
    this.plainSpaceBefore(at);
    // A reference needs a space (or opening punctuation) before it:
    // `Compare@tbl:b` would not read as one when the file is reopened.
    if (at.node.nodeType === Node.TEXT_NODE && at.offset > 0) {
      const prev = (at.node as Text).data[at.offset - 1] ?? "";
      if (/[^\s([{"'“‘]/.test(prev)) {
        (at.node as Text).insertData(at.offset, " ");
        at = { ...at, offset: at.offset + 1 };
      }
    }
    const range = document.createRange();
    range.setStart(at.node, at.offset);
    range.collapse(true);
    range.insertNode(node);
    range.setStartAfter(node);
    // ...and a space after it when a word follows: `[@a]compute`.
    const next = node.nextSibling;
    if (
      next?.nodeType === Node.TEXT_NODE &&
      /^[\p{L}\p{N}]/u.test((next as Text).data)
    ) {
      (next as Text).insertData(0, " ");
    }
    this.syncFromDom();
    this.renderCrossRefs(host);
    this.emitChange("insert");
    this.setCaret(
      node.parentNode ?? host,
      Array.from(node.parentNode?.childNodes ?? []).indexOf(node as ChildNode) +
        1,
    );
    return null;
  }

  /* --- Citations (spec: docs/specs/citations.md, ADR-0028) --- */

  private bibCache: {
    text: string;
    bib: Bibliography;
    keys: ReadonlySet<string>;
  } | null = null;

  /** The document's bibliography: every ```bibtex block, the first
   * definition of a key winning. Cached on the blocks' text. */
  private bibliography(): { bib: Bibliography; keys: ReadonlySet<string> } {
    const blocks = (this.doc?.blocks ?? []).filter(
      (b): b is CodeBlock => b.kind === "code" && isBibLang(b.lang),
    );
    const text = blocks.map((b) => b.text).join("\n\u0000\n");
    if (this.bibCache?.text !== text) {
      const entries: Bibliography["entries"] = [];
      const errors: string[] = [];
      const seen = new Set<string>();
      for (const b of blocks) {
        const one = parseBibtex(b.text);
        errors.push(...one.errors);
        for (const e of one.entries) {
          if (seen.has(e.key)) continue;
          seen.add(e.key);
          entries.push(e);
        }
      }
      this.bibCache = { text, bib: { entries, errors }, keys: seen };
    }
    return this.bibCache;
  }

  /** Inline conversion knows the bibliography's keys (a bare @key). */
  private inlineOpts(): InlineOptions {
    return { citeKeys: this.bibliography().keys };
  }

  private citeFormat: Formatted | null = null;

  /**
   * Fill every citation ("(Knuth, 1984)" / "[2]") in reading order -
   * footnotes included - and redraw the reference lists to match.
   */
  private renderCitations(host: Element): void {
    if (!this.doc) return;
    const style = themeFromDoc(this.doc).citationStyle;
    const { bib } = this.bibliography();
    const atoms = Array.from(
      host.querySelectorAll<HTMLElement>("span.folio-cite"),
    ).map((a) => ({ a, c: parseCitation(a.dataset.cite ?? "") }));
    const clusters = atoms
      .map((x) => x.c)
      .filter((c): c is Cluster => c !== null);
    const f = formatBibliography(bib.entries, citedKeys(clusters), style);
    this.citeFormat = f;
    const runsByKey = new Map(f.entries.map((e) => [e.entry.key, e.runs]));
    for (const { a, c } of atoms) {
      if (!c) continue;
      const r = formatCitation(c, f, style);
      a.textContent = r.text;
      a.classList.toggle("folio-cite-missing", r.missing.length > 0);
      a.title = r.missing.length
        ? `No reference with the key ${r.missing.map((k) => `"${k}"`).join(", ")} - add it to the bibliography`
        : c.items.map((i) => runsText(runsByKey.get(i.key) ?? [])).join("\n");
    }
    for (const fig of Array.from(
      host.querySelectorAll<HTMLElement>("figure.folio-drawn"),
    )) {
      if (isBibLang(fig.dataset.lang)) this.drawReferences(fig, f, style);
    }
  }

  /** Formatted runs as DOM: italics, and links that open outside. */
  private runsToDom(runs: Run[], into: HTMLElement): void {
    for (const r of runs) {
      if (r.link) {
        const a = document.createElement("a");
        a.href = r.link;
        a.textContent = r.text;
        into.appendChild(a);
      } else if (r.em) {
        const i = document.createElement("i");
        i.textContent = r.text;
        into.appendChild(i);
      } else {
        into.appendChild(document.createTextNode(r.text));
      }
    }
  }

  /**
   * A bibliography block's picture: the cited entries it defines,
   * formatted; on screen only, the entries not cited yet and anything
   * the BibTeX reader could not read.
   */
  private drawReferences(
    figure: HTMLElement,
    f: Formatted,
    style: string,
  ): void {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    const view = figure.querySelector<HTMLElement>(".code-view");
    if (!code || !view) return;
    const own = parseBibtex(this.codeText(code));
    const sig = JSON.stringify([
      style,
      own,
      f.entries.map((e) => [e.entry.key, e.label, runsText(e.runs)]),
    ]);
    if (view.dataset.sig === sig) return;
    view.dataset.sig = sig;
    view.textContent = "";
    view.classList.remove("drawn-error");
    // The list is the content now, not an image of it.
    view.removeAttribute("role");
    view.removeAttribute("aria-label");
    const mine = new Set(own.entries.map((e) => e.key));
    const listed = f.entries.filter((e) => mine.has(e.entry.key));
    const ol = document.createElement("ol");
    ol.className = `folio-refs folio-refs-${style}`;
    const fill = (
      list: HTMLOListElement,
      items: Formatted["entries"],
    ): void => {
      for (const e of items) {
        const li = document.createElement("li");
        li.dataset.key = e.entry.key;
        if (e.label) {
          const lab = document.createElement("span");
          lab.className = "ref-label";
          lab.textContent = e.label;
          li.appendChild(lab);
        }
        const text = document.createElement("span");
        text.className = "ref-text";
        this.runsToDom(e.runs, text);
        li.appendChild(text);
        list.appendChild(li);
      }
    };
    fill(ol, listed);
    if (listed.length) view.appendChild(ol);
    const cited = new Set(f.entries.map((e) => e.entry.key));
    const waiting = own.entries.filter((e) => !cited.has(e.key));
    if (!own.entries.length && !own.errors.length) {
      const p = document.createElement("p");
      p.className = "folio-refs-note";
      p.textContent =
        "No references yet - click here and paste BibTeX (Google Scholar, Zotero and journals all export it).";
      view.appendChild(p);
    } else if (waiting.length) {
      // On screen only: what is ready to cite, formatted, so a paste
      // can be checked before anything cites it.
      const p = document.createElement("p");
      p.className = "folio-refs-note";
      p.textContent = listed.length
        ? "Not cited yet (not printed):"
        : "Nothing cited yet - Insert › Citation to cite these (not printed until cited):";
      view.appendChild(p);
      const rest = document.createElement("ol");
      rest.className = "folio-refs folio-refs-author-date folio-refs-uncited";
      fill(
        rest,
        formatBibliography(
          waiting,
          waiting.map((e) => e.key),
          "author-date",
        ).entries,
      );
      view.appendChild(rest);
    }
    for (const err of own.errors) {
      const p = document.createElement("p");
      p.className = "folio-refs-error";
      p.textContent = `BibTeX: ${err}`;
      view.appendChild(p);
    }
  }

  /**
   * A bibliography's header says where BibTeX comes from; a click on
   * the list puts the caret at the end of the source, ready for a
   * paste; and a paste into the untouched example entry replaces it.
   */
  private attachBibliographyEditing(
    figure: HTMLElement,
    bar: HTMLElement,
  ): void {
    const hint = document.createElement("span");
    hint.className = "insp-hint";
    hint.textContent =
      "Paste BibTeX from Google Scholar (Cite › BibTeX), Zotero or a journal";
    bar.append(hint);
    const code = (): HTMLElement | null =>
      figure.querySelector<HTMLElement>("pre.folio-code > code");
    figure.addEventListener("click", (ev) => {
      const t = ev.target as Element;
      if (t.closest("pre.folio-code, .folio-inspector, a")) return;
      const c = code();
      if (c) this.setCaret(c, c.childNodes.length);
    });
    figure.addEventListener("paste", (ev) => {
      const idx = Number(figure.dataset.blockIndex ?? -1);
      const block = this.doc?.blocks[idx];
      const text = ev.clipboardData?.getData("text/plain") ?? "";
      if (
        block?.kind !== "code" ||
        block.text !== BIBTEX_STARTER ||
        !text.includes("@")
      ) {
        return;
      }
      ev.preventDefault();
      block.text = text.trim();
      this.render();
      this.emitChange("insert");
      this.shadowRoot
        ?.querySelector(`[data-block-index="${String(idx)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  /** Every reference a citation can name, for the "Cite" picker. */
  citationChoices(): { key: string; label: string; title: string }[] {
    return this.bibliography().bib.entries.map((e) => {
      const who = e.authors[0]?.family ?? e.editors[0]?.family ?? "";
      return {
        key: e.key,
        label: [who, e.fields.year].filter(Boolean).join(" ") || e.key,
        title: e.fields.title ?? "",
      };
    });
  }

  /**
   * Insert `[@key]` at the caret - or, right after another bracketed
   * citation, add to it: `[@a; @b]` reads "(A, 2001; B, 2002)", where
   * two would read "(A, 2001)(B, 2002)". Returns why it could not, or
   * null.
   */
  insertCitation(key: string, locator = ""): string | null {
    const item = `@${key}${locator ? `, ${locator}` : ""}`;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const at = this.caretPoint();
    let prev: Node | null = null;
    if (at) {
      if (at.node.nodeType === Node.TEXT_NODE) {
        const before = (at.node as Text).data.slice(0, at.offset);
        if (!before.trim()) prev = at.node.previousSibling;
      } else {
        prev = at.node.childNodes[at.offset - 1] ?? null;
      }
    }
    const cite =
      prev instanceof HTMLElement &&
      prev.matches("span.folio-cite:not(.folio-cite-narrative)")
        ? prev
        : null;
    const source = cite?.dataset.cite ?? "";
    if (host && cite && source.endsWith("]")) {
      cite.dataset.cite = `${source.slice(0, -1)}; ${item}]`;
      this.syncFromDom();
      this.renderCrossRefs(host);
      this.emitChange("insert");
      const parent = cite.parentNode ?? host;
      this.setCaret(
        parent,
        Array.from(parent.childNodes).indexOf(cite as ChildNode) + 1,
      );
      return null;
    }
    return this.insertInlineAtom(`[${item}]`, "span.folio-cite", "citation");
  }

  /**
   * Insert a bibliography: a "References" heading and a ```bibtex block
   * with one real entry to show the shape, at the end of the document
   * (before the footnotes). With one already there, go to it instead.
   */
  insertBibliography(): string | null {
    if (!this.doc) return null;
    const existing = this.doc.blocks.findIndex(
      (b) => b.kind === "code" && isBibLang(b.lang),
    );
    if (existing >= 0) {
      this.shadowRoot
        ?.querySelector(`[data-block-index="${String(existing)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return "This document already has a bibliography - add entries to it";
    }
    const blocks = this.doc.blocks;
    let at = blocks.length;
    while (at > 0 && blocks[at - 1]?.kind === "footnotes") at--;
    blocks.splice(
      at,
      0,
      { kind: "heading", level: 2, text: "References" },
      { kind: "code", lang: "bibtex", text: BIBTEX_STARTER },
    );
    this.render();
    this.emitChange("insert");
    this.shadowRoot
      ?.querySelector(`[data-block-index="${String(at + 1)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }

  /**
   * Before inserting an inline atom (a footnote or cross-reference) at
   * a caret: a space typed just before it is a no-break space (the
   * browser keeps a trailing space visible that way, and turns it back
   * only when a LETTER follows) - it must not reach the file.
   */
  private plainSpaceBefore(at: { node: Node; offset: number }): void {
    if (at.node.nodeType !== Node.TEXT_NODE || at.offset === 0) return;
    const t = at.node as Text;
    if (t.data[at.offset - 1] === "\u00a0")
      t.replaceData(at.offset - 1, 1, " ");
  }

  /** The labels referenced in the page, in reading order, each once. */
  private footnoteOrder(host: Element): string[] {
    const seen: string[] = [];
    for (const sup of Array.from(
      host.querySelectorAll<HTMLElement>("sup.folio-fnref"),
    )) {
      const label = sup.dataset.fn ?? "";
      if (label && !seen.includes(label)) seen.push(label);
    }
    return seen;
  }

  private notesSignature = "";

  /**
   * Number the footnote references in reading order and build the
   * Notes section at the end of the page (spec: docs/specs/footnotes.md):
   * one entry per note, in the order first referred to, then any note
   * nothing refers to. A note's text edits in place and writes back to
   * its definition. Rebuilt only when the references change.
   */
  private renderNotes(host: Element, force = false): void {
    if (!this.doc) return;
    const notes = new Map<string, Footnote>();
    for (const b of this.doc.blocks) {
      if (b.kind === "footnotes")
        for (const n of b.notes) notes.set(n.label, n);
    }
    const order = this.footnoteOrder(host);
    for (const label of notes.keys())
      if (!order.includes(label)) order.push(label);
    const number = new Map(order.map((l, i) => [l, i + 1]));
    // The numbers in the text, always (cheap, and refs come and go).
    for (const sup of Array.from(
      host.querySelectorAll<HTMLElement>("sup.folio-fnref"),
    )) {
      const a = sup.querySelector("a");
      const n = number.get(sup.dataset.fn ?? "");
      if (a) a.textContent = n === undefined ? "?" : String(n);
      sup.title = notes.get(sup.dataset.fn ?? "")?.text ?? "No note yet";
    }
    const signature =
      order.join("\u0000") + "|" + [...notes.keys()].join("\u0000");
    const existing = host.querySelector(":scope > section.folio-notes");
    if (!force && existing && signature === this.notesSignature) return;
    this.notesSignature = signature;
    existing?.remove();
    if (order.length === 0) return;
    const section = document.createElement("section");
    section.className = "folio-notes";
    section.contentEditable = "false";
    section.setAttribute("role", "doc-endnotes");
    const title = document.createElement("p");
    title.className = "folio-notes-title";
    title.textContent = "Notes";
    const ol = document.createElement("ol");
    for (const label of order) {
      const li = document.createElement("li");
      li.dataset.fn = label;
      const text = document.createElement("span");
      text.className = "fn-text";
      const note = notes.get(label);
      if (note) {
        text.contentEditable = "true";
        text.innerHTML = inlineMarkdownToHtml(
          note.text.replace(/\n/g, " "),
          this.inlineOpts(),
        );
        text.addEventListener("input", (ev) => {
          // Handled here, whole: the article's input handling re-reads
          // the page and restores ITS caret, which threw note typing
          // into another note.
          ev.stopPropagation();
          note.text = htmlToInlineMarkdown(text.innerHTML).replace(/\n+$/, "");
          const ref = host.querySelector<HTMLElement>(
            `sup.folio-fnref[data-fn="${CSS.escape(label)}"]`,
          );
          if (ref) ref.title = note.text;
          this.emitChange("type");
        });
      } else {
        text.classList.add("fn-missing");
        text.textContent = `No note for [^${label}] yet - add one in the Markdown view.`;
      }
      const back = document.createElement("a");
      back.className = "fn-back";
      back.setAttribute("role", "doc-backlink");
      back.tabIndex = 0;
      back.title = "Back to the text";
      back.textContent = "↩";
      // A no-break space: the ↩ never wraps onto a line of its own.
      li.append(text, "\u00a0", back);
      ol.appendChild(li);
    }
    section.append(title, ol);
    // A note is its own small editor: the article's keyboard handling
    // (block navigation, Enter splitting paragraphs, list keys) must
    // not act on it. Enter does nothing - a note is one paragraph.
    section.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") ev.preventDefault();
      // Home / End within the note's own text: the line ends in the
      // non-editable ↩, and the browser's End jumped past it into the
      // NEXT note.
      if ((ev.key === "End" || ev.key === "Home") && !ev.shiftKey) {
        const text = (ev.target as Element).closest?.(".fn-text");
        if (text) {
          ev.preventDefault();
          if (ev.key === "Home") {
            this.setCaret(text, 0);
          } else {
            const w = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
            let last: Node = text;
            for (let t = w.nextNode(); t; t = w.nextNode()) last = t;
            this.setCaret(
              last,
              last === text
                ? text.childNodes.length
                : (last.textContent ?? "").length,
            );
          }
        }
      }
    });
    section.addEventListener("beforeinput", (ev) => ev.stopPropagation());
    host.appendChild(section);
  }

  /**
   * Jump between a reference and its note (no href: these are not
   * links to follow). Each jump moves the CARET too - to the end of the
   * note, or just after the reference - so typing carries on there; the
   * note jumped to is highlighted for a moment.
   */
  private handleFootnoteClick(ev: MouseEvent): boolean {
    const t = ev.target as Element;
    const host =
      this.shadowRoot?.querySelector<HTMLElement>("article.folio-doc");
    if (!host) return false;
    const ref = t.closest?.("sup.folio-fnref") as HTMLElement | null;
    if (ref) {
      ev.preventDefault();
      const li = host.querySelector<HTMLElement>(
        `section.folio-notes li[data-fn="${CSS.escape(ref.dataset.fn ?? "")}"]`,
      );
      if (!li) return true;
      li.scrollIntoView({ behavior: "smooth", block: "center" });
      li.classList.remove("folio-fn-target");
      void li.offsetWidth; // restart the highlight
      li.classList.add("folio-fn-target");
      const text = li.querySelector<HTMLElement>(
        ".fn-text[contenteditable='true']",
      );
      if (text) {
        text.focus({ preventScroll: true });
        const w = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
        let last: Node = text;
        for (let n = w.nextNode(); n; n = w.nextNode()) last = n;
        this.setCaret(
          last,
          last === text
            ? text.childNodes.length
            : (last.textContent ?? "").length,
        );
      }
      return true;
    }
    const back = t.closest?.("a.fn-back");
    if (back) {
      ev.preventDefault();
      const label =
        (back.closest("li") as HTMLElement | null)?.dataset.fn ?? "";
      const sup = host.querySelector<HTMLElement>(
        `sup.folio-fnref[data-fn="${CSS.escape(label)}"]`,
      );
      if (!sup?.parentNode) return true;
      sup.scrollIntoView({ behavior: "smooth", block: "center" });
      host.focus({ preventScroll: true });
      const parent = sup.parentNode;
      this.setCaret(parent, Array.from(parent.childNodes).indexOf(sup) + 1);
      this.trackCaret();
      return true;
    }
    return false;
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
    const jscad = block.lang === "jscad";
    const drawn = isDrawnLang(block.lang);
    const figure = document.createElement("figure");
    figure.className = strudel
      ? "folio-codeblock folio-strudel"
      : drawn
        ? `folio-codeblock folio-drawn folio-${block.lang ?? ""}`
        : "folio-codeblock";
    figure.dataset.blockIndex = String(idx);
    if (block.lang !== undefined) figure.dataset.lang = block.lang;
    // The fence info beyond the language rides on the figure, so the
    // DOM -> model sync keeps it (it was dropped on every keystroke).
    if (block.info !== undefined) figure.dataset.info = block.info;
    figure.appendChild(this.buildCodeInspector(figure, block));
    if (drawn) {
      // The DRAWING is the figure (spec: docs/specs/drawn-blocks.md);
      // its code shows only while the header is open.
      const view = document.createElement("div");
      view.className = jscad ? "code-view jscad-view" : "code-view";
      view.contentEditable = "false";
      view.setAttribute("role", "img");
      view.setAttribute(
        "aria-label",
        DRAWN_LANGS[block.lang ?? ""] ?? "drawing",
      );
      view.textContent = "Drawing…";
      if (jscad) this.attachJscadRotate(figure, view);
      figure.appendChild(view);
    }
    const pre = document.createElement("pre");
    pre.className = strudel ? "folio-code strudel-source" : "folio-code";
    if (block.lang !== undefined) pre.dataset.lang = block.lang;
    const code = document.createElement("code");
    code.textContent = block.text;
    pre.appendChild(code);
    figure.appendChild(pre);
    void this.highlightCode(figure);
    if (drawn) void this.drawDrawn(figure);
    return figure;
  }

  /** Draw a drawn-language figure from its code (by language). */
  private drawDrawn(figure: HTMLElement): Promise<void> {
    const lang = figure.dataset.lang ?? "";
    if (lang === "jscad") return this.drawJscad(figure);
    if (lang === "dot" || lang === "graphviz") return this.drawGraphviz(figure);
    if (lang === "vega-lite") return this.drawVegaLite(figure);
    if (lang === "svg") return this.drawSvg(figure);
    if (lang === "abc") return this.drawAbc(figure);
    if (isBibLang(lang)) {
      // The model follows the code body on input; the lists follow it.
      const host = figure.closest("article.folio-doc");
      if (host) this.renderCitations(host);
    }
    return Promise.resolve();
  }

  /** Show a drawn figure's error as its content. */
  private drawnError(view: HTMLElement, what: string, e: unknown): void {
    view.textContent = `${what} error: ${e instanceof Error ? e.message : String(e)}`;
    view.classList.add("drawn-error");
  }

  /* --- ABC music (spec: docs/specs/drawn-blocks.md, ADR-0023) --- */

  /** The one music context, made inside a Play click (autoplay). */
  private abcCtx: AudioContext | null = null;
  private abcPlaying: {
    figure: HTMLElement;
    playback: Playback;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  /**
   * Engrave ABC notation as a score (abcjs, bundled, lazy) in the
   * theme's ink and fonts. abcjs's own warnings (an unknown symbol, a
   * bar too long) show under the score.
   */
  private async drawAbc(figure: HTMLElement): Promise<void> {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    const view = figure.querySelector<HTMLElement>(".code-view");
    if (!code || !view || !this.doc) return;
    try {
      const abcjs = (await import("abcjs")).default;
      const theme = themeFromDoc(this.doc);
      const c = theme.colors[this.mode()];
      const font = /^"([^"]+)"/.exec(theme.bodyFont)?.[1] ?? "serif";
      view.textContent = "";
      view.classList.remove("drawn-error");
      const score = document.createElement("div");
      score.className = "abc-score";
      view.appendChild(score);
      const tunes = abcjs.renderAbc(score, this.codeText(code), {
        responsive: "resize",
        add_classes: true,
        foregroundColor: c.ink,
        paddingtop: 4,
        paddingbottom: 4,
        paddingleft: 0,
        paddingright: 0,
        format: {
          titlefont: `"${font}" 17`,
          subtitlefont: `"${font}" 13`,
          composerfont: `"${font}" 12`,
          tempofont: `"${font}" 11`,
          gchordfont: `"${font}" 12`,
          annotationfont: `"${font}" 12`,
          vocalfont: `"${font}" 12`,
          wordsfont: `"${font}" 12`,
        },
      });
      const tune = tunes[0];
      const warnings = (tune?.warnings ?? []).map((w) =>
        String(w).replace(/<[^>]+>/g, ""),
      );
      if (!tune || tune.lines.length === 0) {
        throw new Error(
          warnings[0] ?? "no music found - an ABC tune starts with X: and K:",
        );
      }
      if (warnings.length > 0) {
        const warn = document.createElement("div");
        warn.className = "abc-warnings";
        warn.textContent = `Music warning: ${warnings.join("; ")}`;
        view.appendChild(warn);
      }
    } catch (e) {
      this.drawnError(view, "Music", e);
    }
  }

  /** Play / Stop in a score's header: folio's offline synth. */
  private buildAbcControls(figure: HTMLElement): HTMLElement[] {
    const play = document.createElement("button");
    play.type = "button";
    play.className = "insp-select abc-play";
    play.textContent = PLAY_LABEL;
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "insp-select abc-stop";
    stop.textContent = "■ Stop";
    stop.disabled = true;
    play.addEventListener("click", () => {
      // The context is created and resumed INSIDE the click: WebKit's
      // autoplay policy only lets a gesture start audio.
      if (this.abcCtx === null) {
        try {
          this.abcCtx = new AudioContext();
        } catch {
          return;
        }
      }
      void this.abcCtx.resume();
      const ctx = this.abcCtx;
      const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
      if (!code) return;
      void import("abcjs").then(({ default: abcjs }) => {
        this.stopAbc();
        const tune = abcjs.parseOnly(this.codeText(code))[0];
        if (!tune) return;
        const audio = tune.setUpAudio({}) as {
          tempo: number;
          tracks: Parameters<typeof notesFromAbc>[0];
        };
        const playback = playNotes(
          ctx,
          notesFromAbc(audio.tracks, audio.tempo),
        );
        play.textContent = PLAYING_LABEL;
        stop.disabled = false;
        figure.dataset.playing = "true";
        const timer = setTimeout(
          () => this.stopAbc(),
          playback.length * 1000 + 200,
        );
        this.abcPlaying = { figure, playback, timer };
      });
    });
    stop.addEventListener("click", () => this.stopAbc());
    return [play, stop];
  }

  private stopAbc(): void {
    const p = this.abcPlaying;
    if (!p) return;
    clearTimeout(p.timer);
    p.playback.stop();
    delete p.figure.dataset.playing;
    const btn = p.figure.querySelector<HTMLElement>(".abc-play");
    if (btn) btn.textContent = PLAY_LABEL;
    const stopBtn = p.figure.querySelector<HTMLButtonElement>(".abc-stop");
    if (stopBtn) stopBtn.disabled = true;
    this.abcPlaying = null;
  }

  /** Insert a starter tune after the caret's block. */
  insertAbc(): void {
    if (!this.doc) return;
    const { at, replace } = this.insertionPoint(this.blockIndexAtCaret());
    this.doc.blocks.splice(at, replace, {
      kind: "code",
      lang: "abc",
      text: ABC_STARTER,
    });
    this.render();
    this.emitChange();
  }

  /* --- SVG (spec: docs/specs/drawn-blocks.md) --- */

  /**
   * A hand-written SVG drawing, sanitized (no scripts, no handlers,
   * nothing loaded from outside). It inherits the page's ink as
   * `currentColor` and may use the theme's variables
   * (`var(--folio-accent)` ...), so it follows the theme and the mode.
   */
  private drawSvg(figure: HTMLElement): Promise<void> {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    const view = figure.querySelector<HTMLElement>(".code-view");
    if (!code || !view) return Promise.resolve();
    try {
      view.innerHTML = sanitizeSvg(this.codeText(code));
      view.classList.remove("drawn-error");
    } catch (e) {
      this.drawnError(view, "Drawing", e);
    }
    return Promise.resolve();
  }

  /** Insert a starter SVG drawing after the caret's block. */
  insertSvg(): void {
    if (!this.doc) return;
    const { at, replace } = this.insertionPoint(this.blockIndexAtCaret());
    this.doc.blocks.splice(at, replace, {
      kind: "code",
      lang: "svg",
      text: SVG_STARTER,
    });
    this.render();
    this.emitChange();
  }

  /* --- Vega-Lite (spec: docs/specs/drawn-blocks.md, ADR-0022) --- */

  /**
   * Draw a Vega-Lite JSON spec, headless, to SVG. `"data": {"name":
   * "@dataset"}` reads the live dataset; URL data is refused and the
   * loader can fetch nothing (offline). The theme is Vega-Lite's
   * default config, which the spec's own config overrides.
   */
  private async drawVegaLite(figure: HTMLElement): Promise<void> {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    const view = figure.querySelector<HTMLElement>(".code-view");
    if (!code || !view || !this.doc) return;
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(this.codeText(code));
      } catch (e) {
        throw new Error(
          `the spec is not valid JSON (${e instanceof Error ? e.message : String(e)})`,
        );
      }
      const spec = bindVegaData(parsed, (id) => this.datasetRows(id)) as Record<
        string,
        unknown
      >;
      const [vega, vl] = await Promise.all([
        import("vega"),
        import("vega-lite"),
      ]);
      const theme = themeFromDoc(this.doc);
      const mode = this.mode();
      const c = theme.colors[mode];
      const font = /^"([^"]+)"/.exec(theme.bodyFont)?.[1] ?? "sans-serif";
      const width = Math.max(
        200,
        Math.min(620, (view.clientWidth || 640) - 90),
      );
      const config = {
        background: null,
        font,
        view: { stroke: null, continuousWidth: width, continuousHeight: 240 },
        // Type at the size of folio's own charts (Vega's 8-10px is
        // too small beside them).
        title: { color: c.heading, fontWeight: 600, fontSize: 14 },
        axis: {
          labelColor: c.muted,
          titleColor: c.ink,
          gridColor: c.hairline,
          domainColor: c.rule,
          tickColor: c.rule,
          titleFontWeight: 500,
          labelFontSize: 11,
          titleFontSize: 12,
        },
        // Horizontal x labels (Vega rotates discrete ones by default).
        axisX: { labelAngle: 0 },
        legend: {
          labelColor: c.ink,
          titleColor: c.ink,
          labelFontSize: 11,
          titleFontSize: 12,
        },
        header: {
          labelColor: c.ink,
          titleColor: c.ink,
          labelFontSize: 12,
          titleFontSize: 12,
        },
        range: {
          category: theme.palette[mode],
          // Sequential scales run from the page's tint to its accent.
          // ...from a VISIBLE start: on dark paper the plain tint is the
          // paper itself, and low values vanished.
          heatmap: [mixHex(c.paper, c.accent, 0.18), c.accent],
          ramp: [mixHex(c.paper, c.accent, 0.18), c.accent],
        },
        mark: { color: theme.palette[mode][0] },
        // Rules and text default to black - invisible on dark paper.
        rule: { color: c.ink },
        text: { color: c.ink, fontSize: 12 },
        ...(spec["config"] as Record<string, unknown> | undefined),
      };
      // A single chart (or layer) with no width of its own fills the
      // page: discrete axes otherwise use a narrow fixed step.
      if (
        spec["width"] === undefined &&
        ("mark" in spec || "layer" in spec) &&
        !("facet" in spec) &&
        !("repeat" in spec)
      ) {
        spec["width"] = width;
      }
      const compiled = vl.compile(spec as never, {
        config: config as never,
      }).spec;
      const refuse = (): Promise<never> =>
        Promise.reject(
          new Error("folio documents render offline - nothing is loaded"),
        );
      const runtime = new vega.View(vega.parse(compiled), {
        renderer: "none",
        loader: {
          load: refuse,
          sanitize: refuse,
          http: refuse,
          file: refuse,
        } as never,
      });
      const svg = await runtime.toSVG();
      runtime.finalize();
      view.innerHTML = sanitizeSvg(svg);
      view.classList.remove("drawn-error");
    } catch (e) {
      this.drawnError(view, "Chart", e);
    }
  }

  /** A dataset's recalculated rows as objects (column -> value). */
  private datasetRows(id: string): Record<string, unknown>[] | undefined {
    const t = this.doc?.blocks.find(
      (b) => b.kind === "table" && !b.table.simple && b.table.id === id,
    );
    if (t?.kind !== "table") return undefined;
    const recalced = recalcTable(t.table, this.tablePool(), this.memo());
    return recalced.rows.map((r) =>
      Object.fromEntries(t.table.columns.map((col, i) => [col.name, r[i]])),
    );
  }

  /** Insert a starter Vega-Lite chart after the caret's block. */
  insertVegaLite(): void {
    if (!this.doc) return;
    const { at, replace } = this.insertionPoint(this.blockIndexAtCaret());
    this.doc.blocks.splice(at, replace, {
      kind: "code",
      lang: "vega-lite",
      text: VEGA_STARTER,
    });
    this.render();
    this.emitChange();
  }

  /* --- Graphviz (spec: docs/specs/drawn-blocks.md) --- */

  private vizReady: Promise<{
    renderString(src: string, opts: Record<string, unknown>): string;
  }> | null = null;

  /**
   * Lay out and draw DOT with Graphviz (WebAssembly, bundled, lazily
   * loaded). The theme supplies DEFAULT attributes - fonts, ink,
   * node fill, edge colour - which a graph's own attributes override.
   * The SVG is sanitized: DOT's URL/href attributes become links.
   */
  private async drawGraphviz(figure: HTMLElement): Promise<void> {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    const view = figure.querySelector<HTMLElement>(".code-view");
    if (!code || !view || !this.doc) return;
    try {
      const { instance } = await import("@viz-js/viz");
      this.vizReady ??= instance();
      const viz = await this.vizReady;
      const theme = themeFromDoc(this.doc);
      const c = theme.colors[this.mode()];
      const font = /^"([^"]+)"/.exec(theme.bodyFont)?.[1] ?? "sans-serif";
      const raw = viz.renderString(this.codeText(code), {
        format: "svg",
        graphAttributes: {
          bgcolor: "transparent",
          fontname: font,
          fontcolor: c.ink,
          color: c.rule,
          pad: "0.15",
        },
        nodeAttributes: {
          fontname: font,
          fontcolor: c.ink,
          color: c.accent,
          fillcolor: c.tint,
          style: "filled",
          penwidth: "1.2",
          // Graphviz measures text with its own metrics, not the
          // theme's face: a little more room keeps labels off the edge.
          margin: "0.16,0.07",
        },
        edgeAttributes: {
          fontname: font,
          fontcolor: c.muted,
          color: c.muted,
          arrowsize: "0.7",
        },
      });
      // Natural size (Graphviz's own), shrunk only when wider than the
      // page (CSS max-width) - small graphs must not blow up.
      view.innerHTML = sanitizeSvg(raw);
      view.classList.remove("drawn-error");
    } catch (e) {
      this.drawnError(view, "Diagram", e);
    }
  }

  /* --- JSCAD models (spec: docs/specs/jscad-blocks.md, ADR-0020) --- */

  /** The one sandbox worker, created on the first model. */
  private jscadWorker: Worker | null = null;
  private jscadSeq = 0;
  private jscadPending = new Map<
    number,
    {
      resolve: (p: MeshPolygon[]) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  /** Each model figure's last faces, re-projected on view changes. */
  private jscadMesh = new WeakMap<HTMLElement, MeshPolygon[]>();
  private jscadRedraw: ReturnType<typeof setTimeout> | null = null;

  /** Evaluate a script in the sandbox: faces, or why not. */
  private runJscad(
    source: string,
    params: Record<string, unknown> = {},
  ): Promise<MeshPolygon[]> {
    if (!this.jscadWorker) {
      const w = new Worker(new URL("./jscad/worker.ts", import.meta.url), {
        type: "module",
      });
      w.addEventListener(
        "message",
        (
          ev: MessageEvent<{
            id: number;
            polygons?: MeshPolygon[];
            error?: string;
          }>,
        ) => {
          const job = this.jscadPending.get(ev.data.id);
          if (!job) return;
          this.jscadPending.delete(ev.data.id);
          clearTimeout(job.timer);
          if (ev.data.error !== undefined) job.reject(new Error(ev.data.error));
          else job.resolve(ev.data.polygons ?? []);
        },
      );
      this.jscadWorker = w;
    }
    const worker = this.jscadWorker;
    const id = ++this.jscadSeq;
    return new Promise((resolve, reject) => {
      // A script that never finishes (an endless loop) is stopped:
      // the worker is replaced, and every waiting model says why.
      const timer = setTimeout(() => {
        worker.terminate();
        if (this.jscadWorker === worker) this.jscadWorker = null;
        for (const [k, job] of this.jscadPending) {
          clearTimeout(job.timer);
          job.reject(
            new Error(
              "the model took longer than 5 seconds and was stopped - check for an endless loop",
            ),
          );
          this.jscadPending.delete(k);
        }
      }, JSCAD_TIMEOUT_MS);
      this.jscadPending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, source, params });
    });
  }

  /** Build (or rebuild) a model figure from its code. */
  private async drawJscad(figure: HTMLElement): Promise<void> {
    const code = figure.querySelector<HTMLElement>("pre.folio-code > code");
    const view = figure.querySelector<HTMLElement>(".jscad-view");
    if (!code || !view) return;
    // While the script runs (up to 5 s), the old drawing dims.
    view.classList.add("jscad-building");
    view.title = "Building the model…";
    try {
      const mesh = await this.runJscad(
        this.codeText(code),
        this.jscadRowValues(figure),
      );
      this.jscadMesh.set(figure, mesh);
      this.paintJscad(figure);
    } catch (e) {
      this.jscadMesh.delete(figure);
      view.textContent = `Model error: ${e instanceof Error ? e.message : String(e)}`;
      view.classList.add("jscad-error");
    } finally {
      view.classList.remove("jscad-building");
      view.title = "";
    }
  }

  /**
   * The model's data binding, from its fence info: `params=@table`
   * (a dataset) and `row=N` (1-based; default 1).
   */
  private jscadParams(
    figure: HTMLElement,
  ): { table: string; row: number } | null {
    const block = this.doc?.blocks[Number(figure.dataset.blockIndex ?? -1)];
    if (block?.kind !== "code") return null;
    const info = block.info ?? "";
    const table = /(?:^|\s)params=@([\w-]+)/.exec(info)?.[1];
    if (!table) return null;
    const row = Number(/(?:^|\s)row=(\d+)/.exec(info)?.[1] ?? "1");
    return { table, row: Math.max(1, row) };
  }

  /** The bound row's values by column name - they override the
   * script's parameter defaults (spec: jscad-blocks.md, "Data"). */
  private jscadRowValues(figure: HTMLElement): Record<string, unknown> {
    const bind = this.jscadParams(figure);
    if (!bind) return {};
    const t = this.doc?.blocks.find(
      (b) => b.kind === "table" && !b.table.simple && b.table.id === bind.table,
    );
    if (t?.kind !== "table") {
      throw new Error(`no dataset @${bind.table} - params= names a dataset`);
    }
    const recalced = recalcTable(t.table, this.tablePool(), this.memo());
    const row = recalced.rows[bind.row - 1];
    if (!row) {
      throw new Error(
        `@${bind.table} has no row ${String(bind.row)} (it has ${String(recalced.rows.length)})`,
      );
    }
    const values: Record<string, unknown> = {};
    t.table.columns.forEach((c, i) => (values[c.name] = row[i]));
    return values;
  }

  /** Rewrite one `key=value` of a model's fence info (or drop it). */
  private setJscadInfo(
    figure: HTMLElement,
    key: string,
    value: string | null,
  ): void {
    const block = this.doc?.blocks[Number(figure.dataset.blockIndex ?? -1)];
    if (block?.kind !== "code") return;
    const tokens = (block.info ?? "")
      .split(/\s+/)
      .filter((t) => t !== "" && !t.startsWith(`${key}=`));
    if (value !== null) tokens.push(`${key}=${value}`);
    // Keep params= before row= - the canonical order.
    tokens.sort((a, b) =>
      a.startsWith("params=") ? -1 : b.startsWith("params=") ? 1 : 0,
    );
    if (tokens.length > 0) block.info = tokens.join(" ");
    else delete block.info;
    if (block.info !== undefined) figure.dataset.info = block.info;
    else delete figure.dataset.info;
    this.emitChange();
    void this.drawJscad(figure);
  }

  /** Typing in a drawing's code redraws it once the typing pauses. */
  private scheduleJscadRedraw(): void {
    const at = this.caretPoint()?.node ?? null;
    const el = at instanceof Element ? at : (at?.parentElement ?? null);
    const figure = el?.closest<HTMLElement>("figure.folio-drawn");
    if (!figure) return;
    if (this.jscadRedraw) clearTimeout(this.jscadRedraw);
    this.jscadRedraw = setTimeout(() => {
      this.jscadRedraw = null;
      void this.drawDrawn(figure);
    }, 600);
  }

  /** Project the cached faces for the figure's current view. */
  private paintJscad(figure: HTMLElement): void {
    const view = figure.querySelector<HTMLElement>(".jscad-view");
    const mesh = this.jscadMesh.get(figure);
    if (!view || !mesh || !this.doc) return;
    const theme = themeFromDoc(this.doc);
    const angle = {
      yaw: Number(figure.dataset.yaw ?? VIEWS["iso"]?.yaw ?? -35),
      pitch: Number(figure.dataset.pitch ?? VIEWS["iso"]?.pitch ?? 28),
    };
    // The theme's first series colour - lifted toward the paper on a
    // light page, where deep palette colours shade too dark to read.
    const series = theme.palette[this.mode()][0] ?? "#5a7bb5";
    const fill =
      this.mode() === "light"
        ? mixHex(series, theme.colors.light.paper, 0.35)
        : series;
    try {
      view.innerHTML = meshToSvg(mesh, angle, { fill });
      view.classList.remove("jscad-error");
    } catch (e) {
      view.textContent = `Model error: ${e instanceof Error ? e.message : String(e)}`;
      view.classList.add("jscad-error");
    }
  }

  /** Drag the model to turn it (presentation only - not saved). */
  private attachJscadRotate(figure: HTMLElement, view: HTMLElement): void {
    let from: { x: number; y: number; yaw: number; pitch: number } | null =
      null;
    let frame = 0;
    view.addEventListener("pointerdown", (ev) => {
      if (!this.jscadMesh.has(figure)) return;
      from = {
        x: ev.clientX,
        y: ev.clientY,
        yaw: Number(figure.dataset.yaw ?? VIEWS["iso"]?.yaw ?? -35),
        pitch: Number(figure.dataset.pitch ?? VIEWS["iso"]?.pitch ?? 28),
      };
      view.setPointerCapture(ev.pointerId);
    });
    view.addEventListener("pointermove", (ev) => {
      if (!from) return;
      const start = from;
      figure.dataset.yaw = String(start.yaw - (ev.clientX - start.x) * 0.5);
      figure.dataset.pitch = String(
        Math.max(-90, Math.min(90, start.pitch + (ev.clientY - start.y) * 0.5)),
      );
      const picker = figure.querySelector<HTMLSelectElement>(
        "select.jscad-view-pick",
      );
      if (picker) picker.value = "";
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.paintJscad(figure));
    });
    const end = (): void => {
      from = null;
    };
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
  }

  /** The view picker in a model's header. */
  private buildJscadControls(figure: HTMLElement): HTMLElement[] {
    const pick = document.createElement("select");
    pick.className = "insp-select jscad-view-pick";
    pick.title = "View - or drag the model to turn it";
    pick.setAttribute("aria-label", "Model view");
    const free = document.createElement("option");
    free.value = "";
    free.textContent = "Turned";
    free.hidden = true;
    pick.appendChild(free);
    for (const [id, label] of [
      ["iso", "Isometric"],
      ["front", "Front"],
      ["right", "Right"],
      ["top", "Top"],
    ] as const) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = label;
      pick.appendChild(o);
    }
    pick.value = "iso";
    pick.addEventListener("change", () => {
      const v = VIEWS[pick.value];
      if (!v) return;
      figure.dataset.yaw = String(v.yaw);
      figure.dataset.pitch = String(v.pitch);
      this.paintJscad(figure);
    });
    // Data: a dataset row feeds the parameters (params=@t row=N).
    const dataSel = document.createElement("select");
    dataSel.className = "insp-select jscad-data";
    dataSel.title = "Parameters from a dataset row";
    dataSel.setAttribute("aria-label", "Parameters from dataset");
    const rowSel = document.createElement("select");
    rowSel.className = "insp-select jscad-row";
    rowSel.title = "Which row of the dataset";
    rowSel.setAttribute("aria-label", "Dataset row");
    const fill = (): void => {
      const bind = this.jscadParams(figure);
      dataSel.textContent = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "No data";
      dataSel.appendChild(none);
      for (const b of this.doc?.blocks ?? []) {
        if (b.kind !== "table" || b.table.simple) continue;
        const o = document.createElement("option");
        o.value = b.table.id;
        o.textContent = `@${b.table.id}`;
        dataSel.appendChild(o);
      }
      dataSel.value = bind?.table ?? "";
      rowSel.textContent = "";
      const t = this.doc?.blocks.find(
        (b) => b.kind === "table" && b.table.id === bind?.table,
      );
      rowSel.hidden = t?.kind !== "table";
      if (t?.kind === "table") {
        t.table.rows.forEach((r, n) => {
          const o = document.createElement("option");
          o.value = String(n + 1);
          o.textContent = `Row ${String(n + 1)}: ${String(r[0] ?? "")}`;
          rowSel.appendChild(o);
        });
        rowSel.value = String(bind?.row ?? 1);
      }
    };
    fill();
    figure.addEventListener("mousedown", fill);
    dataSel.addEventListener("change", () => {
      this.setJscadInfo(
        figure,
        "params",
        dataSel.value ? `@${dataSel.value}` : null,
      );
      if (!dataSel.value) this.setJscadInfo(figure, "row", null);
      fill();
    });
    rowSel.addEventListener("change", () => {
      this.setJscadInfo(
        figure,
        "row",
        rowSel.value === "1" ? null : rowSel.value,
      );
    });
    // Export STL: the drawn faces, as a file to 3D-print or open in CAD.
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "insp-select jscad-export";
    exportBtn.textContent = "Export STL";
    exportBtn.title = "Save the model as an STL file (3D printing, CAD)";
    exportBtn.addEventListener("click", () => {
      const mesh = this.jscadMesh.get(figure);
      if (!mesh) return;
      // Models are numbered among the document's models: model-1 ...
      const all = Array.from(
        this.shadowRoot?.querySelectorAll("figure.folio-jscad") ?? [],
      );
      const n = all.indexOf(figure) + 1;
      const bind = this.jscadParams(figure);
      // Named for what it is: the bound row's label ("small"), else
      // its number among the document's models.
      const rowLabel = bind
        ? String(
            (() => {
              const t = this.doc?.blocks.find(
                (b) => b.kind === "table" && b.table.id === bind.table,
              );
              return t?.kind === "table"
                ? (t.table.rows[bind.row - 1]?.[0] ?? bind.row)
                : bind.row;
            })(),
          )
            .trim()
            .replace(/[^\w.-]+/g, "-")
        : "";
      const name = bind
        ? `${bind.table}-${rowLabel || `row${String(bind.row)}`}`
        : `model-${String(n)}`;
      this.dispatchEvent(
        new CustomEvent("folio-export", {
          detail: {
            filename: `${name}.stl`,
            mime: "model/stl",
            text: meshToStl(mesh, name),
          },
          bubbles: true,
          composed: true,
        }),
      );
    });
    return [pick, dataSel, rowSel, exportBtn];
  }

  /**
   * Where an inserted block goes: after the caret's block - or IN
   * PLACE of it when it is an empty paragraph (the line the user made
   * for it), so no stray empty line is left behind.
   */
  private insertionPoint(idx: number): { at: number; replace: number } {
    const blocks = this.doc?.blocks ?? [];
    const here = blocks[idx];
    if (here?.kind === "prose" && here.text.trim() === "") {
      return { at: idx, replace: 1 };
    }
    return { at: idx >= 0 ? idx + 1 : blocks.length, replace: 0 };
  }

  /** Insert a starter Graphviz diagram after the caret's block. */
  insertGraphviz(): void {
    if (!this.doc) return;
    const { at, replace } = this.insertionPoint(this.blockIndexAtCaret());
    this.doc.blocks.splice(at, replace, {
      kind: "code",
      lang: "dot",
      text: GRAPHVIZ_STARTER,
    });
    this.render();
    this.emitChange();
  }

  /** Insert a starter 3D model after the caret's block. */
  insertJscad(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const { at, replace } = this.insertionPoint(idx);
    this.doc.blocks.splice(at, replace, {
      kind: "code",
      lang: "jscad",
      text: JSCAD_STARTER,
    });
    this.render();
    this.emitChange();
  }

  /**
   * A code body is plain text: `<pre><code>text</code></pre>` with
   * only the highlighter's spans inside. Native editing breaks that -
   * typing into an EMPTY block lands in the <pre> beside the empty
   * <code> (and was silently lost), and select-all + retype leaves
   * the engine's <font>/style markup. Rebuild it as plain text, caret
   * at the same text position. Returns the body's text.
   */
  private normalizeCodeBody(pre: HTMLElement): string {
    const code = pre.querySelector(":scope > code");
    const clean =
      code !== null &&
      pre.childNodes.length === 1 &&
      code.querySelector("font, [style], div, p, b, i, u, strong, em") === null;
    if (clean)
      return code.isConnected
        ? (code as HTMLElement).innerText
        : (code.textContent ?? "");
    const text = (
      pre.isConnected ? pre.innerText : (pre.textContent ?? "")
    ).replace(/\n$/, "");
    const at = this.caretPoint();
    const offset =
      at && pre.contains(at.node)
        ? textOffsetIn(pre, at.node, at.offset)
        : null;
    const fresh = document.createElement("code");
    fresh.textContent = text;
    pre.replaceChildren(fresh);
    const figure = pre.closest<HTMLElement>("figure");
    if (figure) this.painted.delete(figure);
    if (offset !== null && fresh.firstChild) {
      this.setCaret(fresh.firstChild, Math.min(offset, text.length));
    } else if (offset !== null) {
      this.setCaret(fresh, 0);
    }
    return text;
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
    if (block.lang === "jscad") {
      bar.append(...this.buildJscadControls(figure));
    }
    if (block.lang === "abc") {
      bar.append(...this.buildAbcControls(figure));
    }
    if (isBibLang(block.lang)) this.attachBibliographyEditing(figure, bar);
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
    // Online sample banks need consent (ADR-0019): a pattern's own
    // samples('github:...') would download from the internet.
    const consent = document.createElement("span");
    consent.className = "strudel-consent";
    consent.setAttribute("role", "alert");
    consent.hidden = true;
    const consentText = document.createElement("span");
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "insp-select consent-allow";
    allow.textContent = "Download and play";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "insp-select consent-skip";
    skip.textContent = "Play without them";
    consent.append(consentText, allow, skip);
    // The player itself is an add-on (ADR-0026): Strudel is AGPL and
    // folio's builds do not contain it. The first Play asks, once.
    const addon = document.createElement("span");
    addon.className = "strudel-addon";
    addon.setAttribute("role", "alert");
    addon.hidden = true;
    const addonText = document.createElement("span");
    addonText.textContent =
      `Playing Strudel patterns needs the Strudel player, a free add-on ` +
      `(AGPL-3.0, ${STRUDEL_SIZE}). folio downloads it once from the ` +
      `internet and keeps it, so it plays offline after that.`;
    const install = document.createElement("button");
    install.type = "button";
    install.className = "insp-select addon-install";
    install.textContent = "Install and play";
    const later = document.createElement("button");
    later.type = "button";
    later.className = "insp-select addon-later";
    later.textContent = "Not now";
    addon.append(addonText, install, later);
    let addonFor: { src: string; offline: boolean } | null = null;

    const source = (): string | null => {
      const code = figure.querySelector<HTMLElement>(
        "pre.strudel-source > code",
      );
      return code ? this.codeText(code) : null;
    };
    const start = (src: string, offline: boolean): void => {
      consent.hidden = true;
      err.hidden = true;
      // Unlock audio SYNCHRONOUSLY, inside the gesture, BEFORE
      // the async import - the load must never eat the activation
      // window (the play-does-nothing bug on WebKitGTK).
      this.ensureStrudelAudio();
      play.textContent = PLAYING_LABEL;
      void strudelInstalled().then((ok) => {
        if (ok) {
          void this.playStrudel(figure, src, err, play, { offline });
          return;
        }
        play.textContent = PLAY_LABEL;
        addonFor = { src, offline };
        addon.hidden = false;
      });
    };
    install.addEventListener("click", () => {
      if (!addonFor) return;
      const { src, offline } = addonFor;
      // Unlock audio inside THIS click, before the download.
      this.ensureStrudelAudio();
      install.disabled = later.disabled = true;
      const was = addonText.textContent;
      addonText.textContent = "Downloading the Strudel player…";
      void installStrudel()
        .then(() => {
          addon.hidden = true;
          play.textContent = PLAYING_LABEL;
          return this.playStrudel(figure, src, err, play, { offline });
        })
        .catch((e: unknown) => {
          addon.hidden = true;
          err.textContent = `Could not install: ${e instanceof Error ? e.message : String(e)}`;
          err.hidden = false;
        })
        .finally(() => {
          install.disabled = later.disabled = false;
          addonText.textContent = was;
        });
    });
    later.addEventListener("click", () => {
      addon.hidden = true;
      addonFor = null;
    });
    play.addEventListener("click", () => {
      const src = source();
      if (src === null) return;
      const pending = onlineSampleSources(src).filter(
        (s) => !this.allowedSampleSources.has(s),
      );
      if (pending.length === 0) {
        start(src, false);
        return;
      }
      consentText.textContent =
        `This pattern downloads sounds from the internet (${pending.join(", ")}). ` +
        "It needs a connection and contacts an outside server; the rest of " +
        "folio stays offline.";
      err.hidden = true;
      consent.hidden = false;
    });
    allow.addEventListener("click", () => {
      const src = source();
      if (src === null) return;
      for (const s of onlineSampleSources(src))
        this.allowedSampleSources.add(s);
      start(src, false);
    });
    skip.addEventListener("click", () => {
      const src = source();
      if (src !== null) start(src, true);
    });
    stop.addEventListener("click", () => {
      err.hidden = true;
      consent.hidden = true;
      addon.hidden = true;
      void this.stopStrudel();
    });
    return [play, stop, err, consent, addon];
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
    opts: { offline?: boolean } = {},
  ): Promise<void> {
    try {
      const strudel = await loadStrudel();
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
            // Load the AudioWorklet effects NOW. initStrudel defers
            // them to the NEXT mousedown on the page, but folio
            // initialises inside the Play click - so shape, crush,
            // coarse... failed on every note until another click
            // (strudel.cc's "Amensister" played silent).
            await strudel.initAudio();
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
      // A pattern's own samples(...) calls (ADR-0019). "Play without
      // them": no-ops - nothing is downloaded and those sounds stay
      // silent. Allowed: a download that FAILS (offline, server
      // down) is reported, never fatal - the rest still plays.
      const g = globalThis as { samples?: unknown };
      const realSamples = g.samples;
      if (typeof realSamples === "function") {
        const real = realSamples as (...a: unknown[]) => Promise<unknown>;
        g.samples = opts.offline
          ? (): Promise<void> => Promise.resolve()
          : (...args: unknown[]): Promise<unknown> =>
              Promise.resolve()
                .then(() => real(...args))
                .catch((e: unknown) => {
                  if (err.isConnected) {
                    err.textContent =
                      "Couldn't download the online sounds (" +
                      (e instanceof Error ? e.message : String(e)) +
                      ") - playing the rest. Check the connection.";
                    err.hidden = false;
                  }
                });
      }
      try {
        await strudel.evaluate(source);
      } finally {
        this.strudelEvalError = null;
        g.samples = realSamples;
      }
      if (status.error !== null) throw status.error;
      this.watchStrudelLog(err);
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
  /**
   * Errors that happen DURING playback (a bad scale name, a sound
   * that will not load) never reject anything: strudel logs them per
   * note and plays on. They reach the playing block's header here -
   * otherwise the only symptom is silence.
   */
  private strudelLogListener: ((ev: Event) => void) | null = null;

  private watchStrudelLog(err: HTMLElement): void {
    this.unwatchStrudelLog();
    this.strudelLogListener = (ev: Event) => {
      const message = (ev as CustomEvent<{ message?: unknown }>).detail
        ?.message;
      if (typeof message !== "string") return;
      const m = /^\[([\w.-]+)\] error: (.*)$/s.exec(message);
      if (!m || !err.isConnected) return;
      err.textContent = `Some sounds failed: ${m[2] ?? ""}`;
      err.hidden = false;
    };
    document.addEventListener("strudel.log", this.strudelLogListener);
  }

  private unwatchStrudelLog(): void {
    if (this.strudelLogListener) {
      document.removeEventListener("strudel.log", this.strudelLogListener);
      this.strudelLogListener = null;
    }
  }

  private async stopStrudel(): Promise<void> {
    this.unwatchStrudelLog();
    this.stopStrudelLights();
    for (const play of Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>(".strudel-play") ?? [],
    )) {
      play.textContent = PLAY_LABEL;
    }
    // Only a player that is running has anything to hush.
    const strudel = await strudelIfLoaded()?.catch(() => null);
    if (strudel) strudel.hush();
  }

  /**
   * Insert a starter strudel block after the caret's block (the
   * toolbar's music button).
   */
  insertStrudel(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const { at, replace } = this.insertionPoint(idx);
    this.doc.blocks.splice(at, replace, {
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
  /** Recalculation results shared within one task (a render, a
   * refresh): a model several tables and charts read is computed once.
   * Dropped at the end of the task, and on every edit. */
  private recalcMemo: RecalcMemo | null = null;

  private memo(): RecalcMemo {
    if (!this.recalcMemo) {
      this.recalcMemo = new WeakMap();
      queueMicrotask(() => {
        this.recalcMemo = null;
      });
    }
    return this.recalcMemo;
  }

  /** A table changed: no result computed before it may be reused. */
  private forgetRecalc(): void {
    this.recalcMemo = null;
  }

  private tablePool(): TablePool {
    const blocks = this.doc?.blocks ?? [];
    return (id: string): Table | undefined => {
      for (const b of blocks) {
        if (b.kind === "table" && b.table.id === id) return b.table;
      }
      return undefined;
    };
  }

  /**
   * Recalculate, keeping a broken formula to its own column: the
   * failing formula is blanked and the table recalculated again, so the
   * rest of the table - and its inspector - stay usable. Its cells read
   * "#ERR"; `errors` maps the column to the message. An error from
   * another table (or one that names no column) blanks every formula.
   */
  private recalcTolerant(table: Table): {
    recalced: Table;
    errors: Map<string, string>;
  } {
    const errors = new Map<string, string>();
    let attempt = table;
    for (let i = 0; i <= table.columns.length; i++) {
      try {
        const recalced = recalcTable(attempt, this.tablePool(), this.memo());
        if (!errors.size) return { recalced, errors };
        const bad = new Set(
          table.columns.flatMap((c, ci) => (errors.has(c.name) ? [ci] : [])),
        );
        return {
          recalced: {
            ...recalced,
            rows: recalced.rows.map((row) =>
              row.map((v, ci) => (bad.has(ci) ? "#ERR" : v)),
            ),
          },
          errors,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const m = /^Formula '([^']+)' in table '([^']+)'/.exec(message);
        const col = m && m[2] === table.id ? m[1] : undefined;
        const blank = (keep: (name: string) => boolean): Table => ({
          ...attempt,
          columns: attempt.columns.map((c) =>
            c.type === "formula" && !keep(c.name) ? { ...c, expr: "''" } : c,
          ),
        });
        if (col !== undefined && !errors.has(col)) {
          errors.set(col, message);
          attempt = blank((name) => name !== col);
          continue;
        }
        // Not one of this table's own columns: blank every formula.
        for (const c of table.columns) {
          if (c.type === "formula" && !errors.has(c.name)) {
            errors.set(c.name, message);
          }
        }
        attempt = blank(() => false);
      }
    }
    return { recalced: { ...table, rows: table.rows }, errors };
  }

  private renderTable(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    idx: number,
  ): HTMLElement {
    const figure = document.createElement("figure");
    figure.dataset.blockIndex = String(idx);
    figure.dataset.tableId = block.table.id;
    // Simple table (a GitHub pipe table) or dataset (`::: table`):
    // spec docs/specs/simple-tables.md.
    figure.dataset.tableKind = block.table.simple ? "table" : "dataset";
    const inspector = this.buildInspector(figure, block);
    figure.appendChild(inspector);
    // A broken formula (a rename that orphaned a reference, bad
    // Jexl) must not take the whole render down: the error shows in
    // place, and the inspector stays up so it can be fixed from the
    // document view.
    const { recalced, errors } = this.recalcTolerant(block.table);
    const shown = new Set<string>();
    for (const [colName, message] of errors) {
      if (shown.has(message)) continue;
      shown.add(message);
      const err = document.createElement("div");
      err.className = "folio-table-error";
      err.textContent = `Table error: ${message}`;
      const ci = block.table.columns.findIndex((c) => c.name === colName);
      if (ci >= 0) {
        err.title = "Click to fix this column's formula";
        // The bar must be reachable from the error itself.
        err.addEventListener("click", () =>
          this.showInspector(figure, block, ci),
        );
      }
      figure.appendChild(err);
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
      const simpleAlign = this.simpleAlign(block.table, ci);
      if (simpleAlign === "right") th.classList.add("num");
      if (simpleAlign === "center") th.classList.add("align-center");
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
          td.textContent = formatComputed(v, col.format);
          if (typeof v === "number") td.classList.add("num");
          if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            td.classList.add("date");
          }
        } else {
          if (col.type === "date") td.classList.add("date");
          if (col.type === "number") {
            td.classList.add("num");
          }
          const simpleAlign = this.simpleAlign(block.table, c);
          if (simpleAlign === "right") td.classList.add("num");
          if (simpleAlign === "center") td.classList.add("align-center");
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
    // A table wider than the page scrolls sideways INSIDE it -
    // never past the paper's edge.
    const scroller = document.createElement("div");
    scroller.className = "folio-table-scroll";
    scroller.appendChild(table);
    figure.appendChild(scroller);
    fitTable(scroller, table);
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
    // Imported data names its source - a citation, so it reads in the
    // document's style and its reference is listed - and says when
    // its terms do not allow sharing, on screen and on paper.
    const personal = block.table.licence === "personal-use";
    if (block.table.cite || personal) {
      const src = document.createElement("div");
      src.className = "folio-table-source";
      src.contentEditable = "false";
      src.innerHTML = block.table.cite
        ? `Source: ${inlineMarkdownToHtml(`@${block.table.cite}`, this.inlineOpts())}`
        : "";
      if (personal) src.appendChild(personalMark(Boolean(block.table.cite)));
      figure.appendChild(src);
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
    colSel.title = "Column";
    colSel.setAttribute("aria-label", "Column");
    colSel.addEventListener("change", () => {
      this.showInspector(figure, block, Math.max(colSel.selectedIndex, 0));
    });

    // The bar says WHICH kind of table this is, and offers the way to
    // the other kind (spec: docs/specs/simple-tables.md).
    const kind = document.createElement("span");
    kind.className = "insp-kind";
    const convert = document.createElement("button");
    convert.type = "button";
    convert.className = "insp-convert";
    convert.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    if (block.table.simple) {
      kind.textContent = "Table";
      kind.title =
        "A simple table: a standard Markdown pipe table, readable on GitHub";
      convert.textContent = "Make it a dataset";
      convert.title =
        "Give it an id, typed columns, units, formulas and a caption - and let charts use it. Saved as a ::: table block.";
      convert.addEventListener("click", () => this.tableToDataset(block));
      bar.append(kind, colSel, convert);
      return bar;
    }
    kind.textContent = `Dataset · ${block.table.id}`;
    kind.title =
      "A dataset: typed columns, units, formulas and a caption; charts and other tables refer to it by id";
    const blocker = this.simpleBlocker(block.table);
    convert.textContent = "Convert to simple table";
    convert.classList.toggle("blocked", blocker !== null);
    convert.title =
      blocker ??
      "Save it as a standard Markdown pipe table (nothing is lost: it has no formulas, units, caption or references)";
    // A blocked conversion SAYS why, visibly, on press - a disabled
    // button with a hover-only reason is invisible on touch.
    const note = document.createElement("span");
    note.className = "insp-note";
    note.setAttribute("role", "status");
    note.hidden = true;
    convert.addEventListener("click", () => {
      const why = this.simpleBlocker(block.table);
      if (why === null) {
        this.tableToSimple(block);
        return;
      }
      note.textContent = `Can't convert: ${why}`;
      note.hidden = false;
    });
    const chartBtn = document.createElement("button");
    chartBtn.type = "button";
    chartBtn.className = "insp-chart";
    chartBtn.textContent = "Chart it";
    chartBtn.title = "Insert a chart of this dataset below it";
    chartBtn.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    chartBtn.addEventListener("click", () => {
      this.chartTable(block.table.id);
    });

    const typeSel = document.createElement("select");
    typeSel.className = "insp-type";
    typeSel.title = "Column type";
    for (const t of ["text", "number", "date", "formula"]) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", () => {
      const type = typeSel.value as "text" | "number" | "date" | "formula";
      const c = Math.max(colSel.selectedIndex, 0);
      // Dates are kept ISO: what reads as a date is rewritten so.
      if (type === "date") {
        for (const row of block.table.rows) {
          const iso = toIso(String(row[c] ?? ""));
          if (iso) row[c] = iso;
        }
      }
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
    const fmtMoney = document.createElement("option");
    fmtMoney.value = "currency";
    fmtMoney.textContent = "money (1,234.56)";
    fmtSel.appendChild(fmtMoney);
    fmtSel.addEventListener("change", () => {
      const c = Math.max(colSel.selectedIndex, 0);
      this.patchColumn(figure, block, c, {
        format:
          fmtSel.value === "percent" || fmtSel.value === "currency"
            ? fmtSel.value
            : undefined,
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
    bar.append(
      kind,
      dsBtn,
      colSel,
      typeSel,
      unitInp,
      fmtSel,
      fx,
      exprInp,
      capInp,
      chartBtn,
      convert,
      note,
    );
    return bar;
  }

  /**
   * A simple table's display alignment for column `c`: the
   * delimiter row's marker, or - unmarked - right when every
   * non-empty cell is a number (ADR-0002: alignment derives from the
   * data). Datasets return null (their column type decides).
   */
  private simpleAlign(
    table: Table,
    c: number,
  ): "left" | "right" | "center" | null {
    if (!table.simple) return null;
    const a = table.simple.align[c] ?? "none";
    if (a !== "none") return a;
    const cells = table.rows
      .map((r) => String(r[c] ?? "").trim())
      .filter((v) => v !== "");
    return cells.length > 0 && cells.every((v) => NUMERIC_RE.test(v))
      ? "right"
      : null;
  }

  /** Why a dataset cannot become a simple table without losing
   * something - or null when it can. */
  private simpleBlocker(table: Table): string | null {
    const names = (pred: (c: Table["columns"][number]) => boolean): string =>
      table.columns
        .filter(pred)
        .map((c) => c.name)
        .join(", ");
    const formulas = names((c) => c.type === "formula");
    if (formulas) {
      return `${formulas} ${formulas.includes(",") ? "are formulas" : "is a formula"}, and formulas need a dataset`;
    }
    const typed = names((c) => c.type !== "text" && c.type !== "number");
    if (typed) return `${typed} has a type only a dataset can hold`;
    const units = names((c) => c.unit !== undefined || c.format !== undefined);
    if (units) return `${units} has a unit or format, which needs a dataset`;
    if (table.caption !== undefined) return "its caption needs a dataset";
    if (table.import !== undefined) return "imported data stays a dataset";
    const charts = (this.doc?.blocks ?? []).filter(
      (b) => b.kind === "chart" && b.chart.source === table.id,
    ).length;
    const formulaRefs = (this.doc?.blocks ?? []).some(
      (b) =>
        b.kind === "table" &&
        b.table.columns.some((c) => c.expr?.includes(`@${table.id}`)),
    );
    if (charts > 0 || formulaRefs) {
      const what = [
        charts > 0 ? `${String(charts)} chart${charts > 1 ? "s" : ""}` : "",
        formulaRefs ? "formulas in other tables" : "",
      ]
        .filter(Boolean)
        .join(" and ");
      return `${what} use${charts === 1 && !formulaRefs ? "s" : ""} this dataset`;
    }
    return null;
  }

  /** Simple table -> dataset: a real id, number columns typed. */
  private tableToDataset(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const t = block.table;
    const ids = new Set(
      (this.doc?.blocks ?? []).flatMap((b) =>
        b.kind === "table" && !b.table.simple ? [b.table.id] : [],
      ),
    );
    let n = 1;
    while (ids.has(`table-${String(n)}`)) n++;
    t.id = `table-${String(n)}`;
    t.columns.forEach((col, c) => {
      const cells = t.rows.map((r) => String(r[c] ?? "").trim());
      const numeric =
        cells.some((v) => v !== "") &&
        cells.every((v) => v === "" || NUMERIC_RE.test(v));
      col.type = numeric ? "number" : "text";
      if (numeric) {
        for (const r of t.rows) {
          const v = String(r[c] ?? "").trim();
          r[c] = v === "" ? "" : Number(v.replaceAll(",", ""));
        }
      }
    });
    delete t.simple;
    this.render();
    this.emitChange();
    const numbers = t.columns
      .filter((c) => c.type === "number")
      .map((c) => c.name);
    this.status(
      `Now a dataset (${t.id})` +
        (numbers.length > 0
          ? ` - ${numbers.join(", ")} ${numbers.length > 1 ? "are now number columns" : "is now a number column"}`
          : ""),
    );
  }

  /** A short message for the host's status line. */
  private status(message: string): void {
    this.dispatchEvent(
      new CustomEvent("folio-status", {
        detail: { message },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Insert a chart of dataset `tableId` right below it: the first
   * text column as categories, the first number/formula column as
   * values, a bar chart (spec: docs/specs/simple-tables.md, "Charts").
   * Returns why it could not, or null on success.
   */
  chartTable(tableId: string, placeAt?: number): string | null {
    if (!this.doc) return "No document";
    const tableAt = this.doc.blocks.findIndex(
      (b) => b.kind === "table" && !b.table.simple && b.table.id === tableId,
    );
    const block = this.doc.blocks[tableAt];
    if (block?.kind !== "table") return "Charts are drawn from a dataset";
    // Below the dataset (Chart it), or where the caret is (palette).
    const at = placeAt !== undefined ? placeAt - 1 : tableAt;
    const cols = block.table.columns;
    const value = cols.find((c) => c.type === "number" || c.type === "formula");
    if (!value) return "A chart needs a number or formula column";
    // A time series (a date column) is a line over time, every number
    // column a line of its own.
    const dated = cols.find((c) => c.type === "date");
    const label =
      dated ?? cols.find((c) => c !== value && c.type === "text") ?? cols[0];
    // A LONG table repeats its labels (Mon, Mon, Mon ...): a first
    // chart that plots every row reads as nonsense. When another text
    // column tells the repeats apart, split by it (one series each).
    const li = label ? cols.indexOf(label) : -1;
    const labels =
      li < 0 ? [] : block.table.rows.map((r) => String(r[li] ?? ""));
    const repeats = new Set(labels).size < labels.length;
    const splitBy = repeats
      ? cols.find((c) => c !== label && c !== value && c.type === "text")
      : undefined;
    const ids = new Set(
      this.doc.blocks.flatMap((b) =>
        b.kind === "chart" && b.chart.id ? [b.chart.id] : [],
      ),
    );
    let id = `${tableId}-chart`;
    for (let n = 2; ids.has(id); n++) id = `${tableId}-chart-${String(n)}`;
    this.doc.blocks.splice(at + 1, 0, {
      kind: "chart",
      chart: {
        id,
        source: tableId,
        query: {
          select: dated
            ? [
                dated.name,
                ...cols
                  .filter((c) => c.type === "number" || c.type === "formula")
                  .slice(0, 6)
                  .map((c) => c.name),
              ]
            : [label?.name ?? value.name, value.name],
        },
        type: dated ? "line" : "bar",
        ...(splitBy && !dated ? { series: splitBy.name } : {}),
        ...(block.table.caption ? { caption: block.table.caption } : {}),
      },
    });
    this.render();
    this.emitChange();
    this.shadowRoot
      ?.querySelector<HTMLElement>(
        `article.folio-doc > [data-block-index="${String(at + 1)}"]`,
      )
      ?.scrollIntoView({ block: "center" });
    // The caret carries on below the chart, so typing is not lost.
    if (placeAt !== undefined && this.doc.blocks[at + 2]) {
      this.focusBlockStart(at + 2);
    }
    return null;
  }

  /**
   * The palette's "Insert a chart": chart the dataset at the caret,
   * else the nearest dataset above it. Returns why it could not.
   */
  insertChart(): string | null {
    if (!this.doc) return "No document";
    const at = this.blockIndexAtCaret();
    const isDataset = (i: number): boolean => {
      const b = this.doc?.blocks[i];
      return b?.kind === "table" && !b.table.simple;
    };
    // The nearest dataset above the caret; else the nearest below (a
    // fresh import sits just under it); else none.
    let found = -1;
    for (let i = at >= 0 ? at : this.doc.blocks.length - 1; i >= 0; i--) {
      if (isDataset(i)) {
        found = i;
        break;
      }
    }
    if (found < 0) {
      for (let i = Math.max(at, 0); i < this.doc.blocks.length; i++) {
        if (isDataset(i)) {
          found = i;
          break;
        }
      }
    }
    const b = this.doc.blocks[found];
    if (b?.kind === "table") {
      // The chart goes where the caret is, not under its dataset.
      return this.chartTable(
        b.table.id,
        at >= 0 ? this.insertionPoint(at).at : undefined,
      );
    }
    return 'Charts are drawn from a dataset - insert one, or click a table\'s "Make it a dataset"';
  }

  /** Dataset -> simple table, only when nothing would be lost. */
  private tableToSimple(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const t = block.table;
    if (this.simpleBlocker(t) !== null) return;
    t.simple = {
      align: t.columns.map((c) => (c.type === "number" ? "right" : "none")),
    };
    t.rows = t.rows.map((r) => t.columns.map((_, c) => String(r[c] ?? "")));
    for (const c of t.columns) {
      c.type = "text";
      delete c.width;
      delete c.align;
    }
    this.render();
    this.emitChange();
    this.status("Now a simple Markdown table");
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
      if (splitSel.value === "") delete chart.series;
      else chart.series = splitSel.value;
      if (stackBox.checked) chart.stack = true;
      else delete chart.stack;
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
      // Only DATASETS feed charts (simple tables have no id to name).
      if (b.kind !== "table" || b.table.simple) continue;
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

    // Several series: split by a column, and stack (bar/area).
    const splitSel = document.createElement("select");
    splitSel.className = "insp-series";
    const fillSplit = (): void => {
      splitSel.textContent = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "(none)";
      splitSel.appendChild(none);
      const table = this.doc?.blocks.find(
        (b) => b.kind === "table" && b.table.id === block.chart.source,
      );
      if (table?.kind === "table") {
        for (const c of table.table.columns) {
          const o = document.createElement("option");
          o.value = c.name;
          o.textContent = c.name;
          splitSel.appendChild(o);
        }
      }
    };
    splitSel.addEventListener("change", () => patch());
    const stackBox = document.createElement("input");
    stackBox.type = "checkbox";
    stackBox.className = "insp-stack";
    stackBox.addEventListener("change", () => patch());

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
      fillSplit();
      splitSel.value = block.chart.series ?? "";
      stackBox.checked = block.chart.stack === true;
      bar.hidden = false;
    };
    figure.addEventListener("mousedown", () => show());

    // Every field is LABELLED: placeholders vanish once filled, and a
    // row of bare boxes says nothing (first-contact feedback).
    bar.classList.add("labelled-bar");
    bar.append(
      labelled("Data", srcSel),
      labelled("Type", typeSel),
      labelled("Columns", selInp),
      labelled("Filter", filterInp),
      labelled("Sort by", sortInp),
      labelled("Order", orderSel),
      labelled("Split by", splitSel),
      labelled("Stack", stackBox),
      labelled("Caption", capInp),
    );
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
    if (fmtSel) fmtSel.value = col.format ?? "default";
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
      type?: "text" | "number" | "date" | "formula";
      unit?: string | undefined;
      format?: "percent" | "currency" | undefined;
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
  insertImportedTable(table: Table, reference?: string): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(at, 0, { kind: "table", table });
    if (reference) this.addReference(reference);
    this.render();
    this.emitChange("insert");
    // The caret moves past the new table: the next import, chart or
    // paragraph follows it, in reading order.
    if (at + 1 < this.doc.blocks.length) this.focusBlockStart(at + 1);
    else this.focusBlockStart(at, true);
  }

  /** Datasets imported for personal use only (export and print
   * remind the user before the document leaves their hands). */
  personalUseTables(): string[] {
    return (this.doc?.blocks ?? []).flatMap((b) =>
      b.kind === "table" && b.table.licence === "personal-use"
        ? [b.table.caption ?? b.table.id]
        : [],
    );
  }

  /** Every key the bibliography defines (an import's new key must be
   * new). */
  referenceKeys(): ReadonlySet<string> {
    return this.bibliography().keys;
  }

  /**
   * Add a BibTeX entry to the document's bibliography - the first
   * ```bibtex block - or start one ("References", at the end, before
   * the footnotes). The caller renders.
   */
  private addReference(bibtex: string): void {
    if (!this.doc) return;
    const blocks = this.doc.blocks;
    const bib = blocks.find(
      (b): b is CodeBlock => b.kind === "code" && isBibLang(b.lang),
    );
    if (bib) {
      // The untouched example entry gives way to a real one.
      bib.text =
        bib.text === BIBTEX_STARTER
          ? bibtex
          : `${bib.text.trimEnd()}\n\n${bibtex}`;
      return;
    }
    let at = blocks.length;
    while (at > 0 && blocks[at - 1]?.kind === "footnotes") at--;
    blocks.splice(
      at,
      0,
      { kind: "heading", level: 2, text: "References" },
      { kind: "code", lang: "bibtex", text: bibtex },
    );
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
      recalced = recalcTable(block.table, this.tablePool(), this.memo());
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
      recalced = recalcTable(block.table, this.tablePool(), this.memo());
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
          cell.textContent = formatComputed(v, col.format);
          if (typeof v === "number") cell.classList.add("num");
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
      // Only NUMBER columns coerce; text keeps exactly what was typed
      // ("0.90" must not become 0.9 - a simple table is text).
      const value: Cell =
        block.table.columns[c]?.type === "number" &&
        /^-?[0-9]+(\.[0-9]+)?$/.test(text)
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
      } else if (isTabKey(ev)) {
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
    const pending: Promise<unknown>[] = [];
    for (const fig of Array.from(
      root.querySelectorAll<HTMLElement>("[data-diagram-id]"),
    )) {
      pending.push(this.drawDiagram(fig));
    }
    // Drawings take the mode's palette too (models only re-project).
    for (const fig of Array.from(
      root.querySelectorAll<HTMLElement>("figure.folio-drawn"),
    )) {
      if (fig.dataset.lang === "jscad") this.paintJscad(fig);
      else pending.push(this.drawDrawn(fig));
    }
    this.restyled = Promise.allSettled(pending).then(() => undefined);
  }

  private restyled: Promise<void> = Promise.resolve();

  /** Resolves once the last mode change has redrawn every figure (an
   * export waits on it before printing). */
  drawn(): Promise<void> {
    return this.restyled;
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
      const recalced = recalcTable(
        tableBlock.table,
        this.tablePool(),
        this.memo(),
      );
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
      const valueColumn = tableBlock.table.columns.find(
        (c) => c.name === valueCol,
      );
      const unit = valueColumn?.unit ?? undefined;
      const style: ChartStyle = {
        color: seriesColor,
        colors: palette,
        text: ink.ink,
        textMuted: ink.muted,
        grid: ink.hairline,
        paper: ink.paper,
        valueFormat: valueColumn?.format,
        // Slices keep their category's color through re-sorts.
        colorKeys: (() => {
          const ci = tableBlock.table.columns.findIndex(
            (c) => c.name === select[0],
          );
          return ci < 0
            ? undefined
            : [...new Set(recalced.rows.map((r) => String(r[ci] ?? "")))];
        })(),
        xTitle: select[0],
        yTitle:
          valueCol === ""
            ? undefined
            : `${valueCol}${unit ? ` (${unit})` : ""}`,
      };
      // Several series (spec: chart-rendering.md "Several series"):
      // more than one value column, or a split-by column, on a bar,
      // line or area chart. Pie/donut/scatter keep the first series.
      const t = block.chart.type;
      if (
        (block.chart.series !== undefined || select.length > 2) &&
        (t === "bar" || t === "line" || t === "area")
      ) {
        const data = chartSeries(recalced, block.chart);
        const multi = renderSeriesChart(data, t, block.chart.stack === true, {
          ...style,
          // Several value columns share no single name: the axis says
          // what the series are measured in, if they agree.
          yTitle:
            block.chart.series !== undefined
              ? style.yTitle
              : unit
                ? `(${unit})`
                : undefined,
        });
        holder.innerHTML =
          multi.svg +
          `<div class="chart-legend">${multi.legend
            .map(
              (l) =>
                `<span class="legend-item"><i style="background:${l.color}"></i>${escapeHtml(l.name)}</span>`,
            )
            .join("")}</div>`;
        return;
      }
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
        b.kind === "audio" ||
        b.kind === "footnotes" ||
        b.kind === "toc",
    );
    let gi = 0;
    const next: DocBlock[] = [];
    const blockEls = Array.from(host.children).filter(
      (c) => !c.classList.contains("folio-notes"),
    );
    for (const child of blockEls) {
      const el = child as HTMLElement;
      if (el.classList.contains("folio-notes")) continue;
      if (
        (el.tagName === "ASIDE" && el.classList.contains("folio-fndefs")) ||
        (el.tagName === "NAV" && el.classList.contains("folio-toc"))
      ) {
        const g = generated[gi];
        gi += 1;
        if (g) next.push(g);
        continue;
      }
      if (el.tagName === "FIGURE" && el.classList.contains("folio-codeblock")) {
        // A code block renders as a figure (its header is the
        // inspector) but stays a text block: the body is re-derived
        // from the DOM like prose. Syntax colors and strudel's
        // playing lights are spans over the text - innerText reads
        // through them.
        const pre = el.querySelector<HTMLElement>("pre.folio-code");
        next.push({
          kind: "code",
          ...(el.dataset.lang !== undefined ? { lang: el.dataset.lang } : {}),
          ...(el.dataset.info !== undefined ? { info: el.dataset.info } : {}),
          text: pre ? this.normalizeCodeBody(pre) : "",
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
      if (el.tagName === "UL" || el.tagName === "OL") {
        next.push({ kind: "list", ...readListBody(el) });
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
    if (next.length === blockEls.length) {
      blockEls.forEach((child, i) => {
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
    // Footnote numbers and the Notes section follow the text - but not
    // while the caret is in a note (rebuilding would drop it).
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (
      host &&
      !(ev?.target instanceof Element && ev.target.closest(".folio-notes"))
    ) {
      this.renderNotes(host);
    }
    if (host) this.renderCrossRefs(host);
    this.scheduleJscadRedraw();
    this.autoformatList();
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
    // Per keystroke the model (and the Markdown source) follow the
    // text, but the recalculation waits until the caret leaves the
    // cell: on a big document it took a beat per letter.
    this.commitCell(cell, block, true);
  }

  /** Bring every figure up to date with the text typed so far (before
   * printing or exporting). */
  flushEdits(): void {
    this.flushPendingRecalc();
  }

  /** A cell edited by typing whose table has not recalculated yet. */
  private pendingCell: { td: HTMLTableCellElement; tableId: string } | null =
    null;

  /** Recalculate the table (and what depends on it) of the cell typed
   * in, once the caret has left it. */
  private flushPendingRecalc(): void {
    const pending = this.pendingCell;
    if (!pending || !this.doc) return;
    this.pendingCell = null;
    const block = this.doc.blocks.find(
      (b) => b.kind === "table" && b.table.id === pending.tableId,
    );
    if (block?.kind !== "table") return;
    const figure =
      pending.td.closest<HTMLElement>("figure") ??
      this.shadowRoot?.querySelector<HTMLElement>(
        `figure[data-table-id="${pending.tableId}"]`,
      ) ??
      null;
    this.updateRowCalculations(figure, block);
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
    defer = false,
  ): void {
    const r = Number(td.dataset.rowIndex);
    const c = Number(td.dataset.colIndex);
    const col = block.table.columns[c];
    if (!col || col.type === "formula") return;
    const text = (td.textContent ?? "").trim();
    // Only NUMBER columns coerce; a text cell keeps exactly what was
    // typed - visiting "0.90" in a simple table must not rewrite it.
    const value: string | number =
      col.type === "number" && /^-?[0-9]+(\.[0-9]+)?$/.test(text)
        ? parseFloat(text)
        : text;
    const row = block.table.rows[r];
    if (!row) return;
    if (row[c] === value) {
      // Leaving a cell whose typing is already in the model: its
      // recalculation is all that is left to do.
      if (!defer && this.pendingCell?.td === td) this.flushPendingRecalc();
      return;
    }
    row[c] = value;
    if (defer) {
      this.pendingCell = { td, tableId: block.table.id };
    } else {
      if (this.pendingCell?.td === td) this.pendingCell = null;
      this.updateRowCalculations(td.closest("figure"), block);
    }
    this.emitChange("cell");
  }

  /** Refresh the row's formula cells and dependent charts in place. */
  private updateRowCalculations(
    figure: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    this.forgetRecalc();
    const recalced = recalcTable(block.table, this.tablePool(), this.memo());
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
        cell.textContent = formatComputed(v, col.format);
        cell.classList.toggle("num", typeof v === "number");
      }
    });
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    this.refreshDependents(block.table.id);
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
        recalcedOther = recalcTable(other.table, this.tablePool(), this.memo());
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
          cell.textContent = formatComputed(v, col.format);
          if (typeof v === "number") cell.classList.add("num");
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
    stale: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    if (!stale || !this.doc || !this.shadowRoot) return;
    this.forgetRecalc();
    const idx = Number(stale.dataset.blockIndex ?? -1);
    // A blur handler may already have replaced the figure: refresh
    // whichever figure is the block's now.
    const host = this.shadowRoot.querySelector("article.folio-doc");
    const figure = stale.isConnected
      ? stale
      : host?.querySelector<HTMLElement>(
          `:scope > [data-block-index="${String(idx)}"]`,
        );
    if (!host || !figure || figure.parentElement !== host) return;
    const fresh = this.renderTable(block, idx);
    fresh.dataset.blockIndex = String(idx);
    host.replaceChild(fresh, figure);
    this.refreshDependents(block.table.id);
  }

  /**
   * Everything drawn FROM a table, after its data changed: every chart
   * (a chart may read any table), and the models bound to it
   * (`params=@table`). ONE place, so no edit path forgets one.
   */
  private refreshDependents(tableId: string): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    for (const cf of Array.from(
      host?.querySelectorAll<HTMLElement>("[data-chart-source]") ?? [],
    )) {
      this.drawChart(cf);
    }
    for (const mf of Array.from(
      host?.querySelectorAll<HTMLElement>("figure.folio-jscad") ?? [],
    )) {
      if (this.jscadParams(mf)?.table === tableId) void this.drawJscad(mf);
    }
    // Vega-Lite charts reading this dataset ("name": "@table").
    for (const vf of Array.from(
      host?.querySelectorAll<HTMLElement>("figure.folio-vega-lite") ?? [],
    )) {
      const src = vf.querySelector<HTMLElement>("pre.folio-code > code");
      let refs: string[] = [];
      try {
        refs = vegaDataRefs(JSON.parse(src ? this.codeText(src) : ""));
      } catch {
        continue;
      }
      if (refs.includes(tableId)) void this.drawVegaLite(vf);
    }
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
      block.kind === "audio" ||
      block.kind === "footnotes" ||
      block.kind === "toc"
    ) {
      return;
    }
    // A list unlists into one block PER ITEM - merging its items
    // into one paragraph would run them together on the page.
    const texts = block.kind === "list" ? flattenList(block) : [block.text];
    if (kind === "p") {
      if (block.kind === "prose") return;
      this.doc.blocks.splice(
        idx,
        1,
        ...texts.map((text): DocBlock => ({ kind: "prose", text })),
      );
    } else {
      const level = kind === "h1" ? 1 : kind === "h2" ? 2 : 3;
      if (block.kind === "heading" && block.level === level) return;
      this.doc.blocks.splice(
        idx,
        1,
        ...texts.map((text): DocBlock => ({ kind: "heading", level, text })),
      );
    }
    this.render();
    this.emitChange();
    this.focusBlockStart(idx);
  }

  /**
   * Toggle the caret's block as a list (spec: docs/specs/lists.md):
   * a paragraph becomes a one-item list (its source line breaks are
   * soft wraps, not items); a list of the same kind unlists into one
   * paragraph per item; a list of the other kind switches between
   * bulleted and numbered.
   */
  toggleList(ordered: boolean): void {
    if (!this.doc) return;
    // In a SUB-list, the buttons switch that sub-list's kind - the
    // outer list is left alone (a bulleted list under a numbered
    // item). The same kind again is a no-op there.
    const li = this.caretListItem();
    const list = li?.parentElement;
    if (li && list && list.parentElement?.tagName === "LI") {
      const want = ordered ? "OL" : "UL";
      if (list.tagName !== want) {
        this.moveListItem(li, () => swapListTag(list, want));
      }
      return;
    }
    const idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (!block) return;
    if (block.kind === "list") {
      if (block.ordered === ordered) {
        this.doc.blocks.splice(
          idx,
          1,
          ...flattenList(block).map((text): DocBlock => ({
            kind: "prose",
            text,
          })),
        );
      } else {
        // Only the top level switches kind; sub-lists keep theirs.
        this.doc.blocks[idx] = { kind: "list", ordered, items: block.items };
      }
    } else if (block.kind === "prose" || block.kind === "heading") {
      this.doc.blocks[idx] = {
        kind: "list",
        ordered,
        items: [{ text: block.text }],
      };
    } else {
      return;
    }
    this.render();
    this.emitChange();
    this.focusBlockStart(idx, true);
  }

  /**
   * The caret inside this shadow root. Chromium has
   * `shadowRoot.getSelection()`; WebKit (the Linux desktop's
   * WebKitGTK) does not - there, the standard
   * `getComposedRanges({ shadowRoots })` is the only way to see a
   * caret inside the component. Without it every caret-aware command
   * acted on the last CLICKED block instead.
   */
  private caretPoint(): {
    node: Node;
    offset: number;
    collapsed: boolean;
  } | null {
    const root = this.shadowRoot as
      (ShadowRoot & { getSelection?: () => Selection | null }) | null;
    if (!root) return null;
    if (typeof root.getSelection === "function") {
      const sel = root.getSelection();
      return sel && sel.rangeCount > 0 && sel.anchorNode
        ? {
            node: sel.anchorNode,
            offset: sel.anchorOffset,
            collapsed: sel.isCollapsed,
          }
        : null;
    }
    const ds = document.getSelection() as
      | (Selection & { getComposedRanges?: (...a: unknown[]) => StaticRange[] })
      | null;
    if (!ds?.getComposedRanges) return null;
    let ranges: StaticRange[] = [];
    try {
      ranges = ds.getComposedRanges({ shadowRoots: [root] });
    } catch {
      try {
        ranges = ds.getComposedRanges(root);
      } catch {
        return null;
      }
    }
    const r = ranges[0];
    return r && root.contains(r.startContainer)
      ? {
          node: r.startContainer,
          offset: r.startOffset,
          collapsed: r.collapsed,
        }
      : null;
  }

  /** Put the caret at `node`/`offset`: the shadow selection where it
   * exists (Chromium), else the document selection (WebKit accepts a
   * shadow node there). */
  private setCaret(node: Node, offset: number): void {
    const root = this.shadowRoot as
      (ShadowRoot & { getSelection?: () => Selection | null }) | null;
    const sel =
      typeof root?.getSelection === "function"
        ? root.getSelection()
        : document.getSelection();
    if (!sel) return;
    const max =
      node.nodeType === Node.TEXT_NODE
        ? (node.textContent ?? "").length
        : node.childNodes.length;
    const at = Math.min(offset, max);
    // setBaseAndExtent, not addRange: WebKit silently IGNORES
    // addRange() for a range inside a shadow root.
    sel.setBaseAndExtent(node, at, node, at);
  }

  /** The caret as it was when the host's UI took focus. */
  private savedCaret: { node: Node; offset: number } | null = null;

  /**
   * Remember the caret before the host's UI (the command palette)
   * takes focus; `restoreCaret` puts it back after. Closing a dialog
   * refocuses the article with the caret at its START - commands run
   * from the palette would otherwise act on the first block.
   */
  saveCaret(): void {
    this.savedCaret = this.caretPoint();
  }

  restoreCaret(): void {
    const at = this.savedCaret;
    if (!at || !at.node.isConnected) return;
    this.shadowRoot
      ?.querySelector<HTMLElement>("article.folio-doc")
      ?.focus({ preventScroll: true });
    this.setCaret(at.node, at.offset);
    this.trackCaret();
  }

  /** The caret's list item, if it is in one (and still attached). */
  private caretListItem(): HTMLElement | null {
    this.trackCaret();
    const li = this.lastLi;
    return li?.isConnected && li.closest("article.folio-doc") ? li : null;
  }

  /**
   * Move a list item in the DOM, keeping the caret where it was, then
   * sync the model (spec: docs/specs/lists.md, Tab / Shift+Tab).
   */
  private moveListItem(li: HTMLElement, move: () => void): void {
    const at = this.caretPoint();
    move();
    if (at && li.contains(at.node)) this.setCaret(at.node, at.offset);
    this.syncFromDom();
    this.emitChange();
  }

  /** Put the caret at the start of `el`. */
  private placeCaret(el: HTMLElement): void {
    this.setCaret(el, 0);
  }

  /** Tab: nest the caret's item under the item above it. */
  indentListItem(): boolean {
    const li = this.caretListItem();
    const prev = li?.previousElementSibling;
    const list = li?.parentElement;
    if (!li || !list || prev?.tagName !== "LI") return false;
    this.moveListItem(li, () => {
      let sub = Array.from(prev.children).find(
        (c) => c.tagName === "UL" || c.tagName === "OL",
      );
      if (!sub) {
        sub = document.createElement(list.tagName.toLowerCase());
        prev.appendChild(sub);
      }
      sub.appendChild(li);
    });
    return true;
  }

  /** Shift+Tab: lift the caret's item one level, keeping order. */
  outdentListItem(): boolean {
    const li = this.caretListItem();
    const list = li?.parentElement;
    const parentLi = list?.parentElement;
    if (!li || !list) return false;
    // On a TOP-level item, Shift+Tab steps out of the list entirely.
    if (parentLi?.tagName !== "LI") return this.liftOutOfList(li);
    this.moveListItem(li, () => {
      // Later siblings stay AFTER it: they become its own sub-list.
      const followers = Array.from(list.children).filter(
        (c) =>
          c !== li &&
          li.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      if (followers.length > 0) {
        let own = Array.from(li.children).find(
          (c) => c.tagName === "UL" || c.tagName === "OL",
        );
        if (!own) {
          own = document.createElement(list.tagName.toLowerCase());
          li.appendChild(own);
        }
        for (const f of followers) own.appendChild(f);
      }
      parentLi.after(li);
      if (list.children.length === 0) list.remove();
    });
    return true;
  }

  /**
   * Turn a TOP-level list item into a paragraph, splitting the list
   * around it (spec: docs/specs/lists.md): items before stay, the
   * item's own sub-list and the items after follow the paragraph as
   * lists (a numbered tail keeps counting). The caret stays put.
   */
  private liftOutOfList(li: HTMLElement): boolean {
    const list = li.parentElement;
    if (!list?.parentElement?.matches("article.folio-doc")) return false;
    const at = this.caretPoint();
    const isSub = (c: Element): boolean => /^(UL|OL)$/.test(c.tagName);
    const sub = Array.from(li.children).find(isSub) as HTMLElement | undefined;
    const before = Array.from(list.children).indexOf(li);
    const after = Array.from(list.children).slice(before + 1);
    const p = document.createElement("p");
    for (const n of Array.from(li.childNodes)) if (n !== sub) p.appendChild(n);
    if (p.childNodes.length === 0) p.appendChild(document.createElement("br"));
    const tail: HTMLElement[] = sub ? [sub] : [];
    if (after.length > 0) {
      const rest = document.createElement(list.tagName.toLowerCase());
      if (list instanceof HTMLOListElement) {
        (rest as HTMLOListElement).start = list.start + before + 1;
      }
      rest.append(...after);
      tail.push(rest);
    }
    li.remove();
    list.after(p, ...tail);
    if (list.children.length === 0) list.remove();
    if (at && p.contains(at.node)) this.setCaret(at.node, at.offset);
    else this.setCaret(p, 0);
    this.syncFromDom();
    this.emitChange();
    this.trackCaret();
    return true;
  }

  /** Whether the caret is collapsed at the very start of `li`'s text. */
  private caretAtItemStart(li: HTMLElement): boolean {
    const at = this.caretPoint();
    if (!at?.collapsed || !li.contains(at.node)) return false;
    const r = document.createRange();
    r.setStart(li, 0);
    r.setEnd(at.node, at.offset);
    return r.toString().replace(/\u200b/g, "") === "";
  }

  /** Whether the caret sits in a list, and which kind. */
  listAtCaret(): "bulleted" | "numbered" | null {
    const block = this.doc?.blocks[this.blockIndexAtCaret()];
    if (block?.kind !== "list") return null;
    return block.ordered ? "numbered" : "bulleted";
  }

  /**
   * The Markdown habit: `- ` (or `* `, `1. `) typed at the start of
   * an otherwise empty paragraph turns it into a list.
   */
  private autoformatList(): boolean {
    if (!this.doc) return false;
    // Inside a list item: `- ` / `1. ` typed into an EMPTY item sets
    // that list's kind - the Markdown habit, at any depth.
    const li = this.caretListItem();
    const own = li
      ? Array.from(li.childNodes)
          .filter((n) => !(n instanceof Element && /^(UL|OL)$/.test(n.tagName)))
          .map((n) => n.textContent ?? "")
          .join("")
      : "";
    const lm = /^(?:([-*+])|(\d{1,9})[.)])[ \u00a0]$/.exec(own);
    if (li && lm) {
      const list = li.parentElement;
      this.moveListItem(li, () => {
        for (const n of Array.from(li.childNodes)) {
          if (!(n instanceof Element && /^(UL|OL)$/.test(n.tagName)))
            n.remove();
        }
        li.prepend(document.createElement("br"));
        const want = lm[2] !== undefined ? "OL" : "UL";
        if (list && list.tagName !== want) swapListTag(list, want);
      });
      this.placeCaret(li);
      return true;
    }
    const idx = this.blockIndexAtCaret();
    const block = this.doc.blocks[idx];
    if (block?.kind !== "prose") return false;
    const m = /^(?:([-*+])|(1)[.)])[ \u00a0]$/.exec(block.text);
    if (!m) return false;
    this.doc.blocks[idx] = {
      kind: "list",
      ordered: m[2] !== undefined,
      items: [{ text: "" }],
    };
    this.render();
    this.focusBlockStart(idx);
    return true;
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
    if (!block || !INLINE_BLOCKS.has(block.tagName) || !block.isConnected) {
      return false;
    }

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
    // A new equation is for writing: its editor opens with the
    // placeholder selected, so typing replaces it (focus fell to the
    // page body, and typed LaTeX went nowhere).
    const fig = this.shadowRoot?.querySelector<HTMLElement>(
      `article.folio-doc > [data-block-index="${String(at)}"]`,
    );
    fig?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const ta = fig?.querySelector<HTMLTextAreaElement>(
      ".folio-inspector textarea",
    );
    ta?.focus();
    ta?.select();
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
    // A code figure's caret belongs in its body, not its header; a
    // list's, in its first (or last) item.
    const el =
      child?.querySelector<HTMLElement>("pre.folio-code > code") ??
      (child && /^(UL|OL)$/.test(child.tagName)
        ? child.querySelector<HTMLElement>(atEnd ? "li:last-of-type" : "li")
        : null) ??
      child;
    if (!el) return;
    el.focus();
    (host as HTMLElement | null)?.focus({ preventScroll: true });
    // The caret goes in through setCaret: WebKit ignores addRange()
    // inside a shadow root (the bullet button dropped focus on the
    // desktop app).
    let node: Node = el;
    if (atEnd) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) node = t;
      this.setCaret(
        node,
        node === el ? el.childNodes.length : (node.textContent ?? "").length,
      );
    } else {
      this.setCaret(el, 0);
    }
    this.trackCaret();
  }

  /**
   * The block index at the caret: the shadow selection's anchor
   * (Chromium), or the last clicked block (tracked via shadow-root
   * hit testing, which pierces in every engine).
   */
  private blockIndexAtCaret(): number {
    let n: Node | null = this.caretPoint()?.node ?? null;
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

  /**
   * Insert a SIMPLE table (a standard Markdown pipe table) after the
   * caret's block - what a Markdown user expects (spec: docs/specs/
   * simple-tables.md). `insertDataset` inserts a typed dataset.
   */
  insertTable(): void {
    this.insertTableBlock(true);
  }

  /** Insert a typed dataset (`::: table`) after the caret's block. */
  insertDataset(): void {
    this.insertTableBlock(false);
  }

  private insertTableBlock(simple: boolean): void {
    if (!this.doc) return;
    // After the caret's block (tracked through the shadow root -
    // window.getSelection() cannot see inside it, which appended
    // every new table at the END of the document).
    const at = this.blockIndexAtCaret();
    const idx = at >= 0 ? at + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(idx, 0, {
      kind: "table",
      table: simple
        ? {
            id: `table-${String(Date.now().toString(36))}`,
            columns: [
              { name: "Column 1", type: "text" },
              { name: "Column 2", type: "text" },
            ],
            rows: [
              ["", ""],
              ["", ""],
            ],
            simple: { align: ["none", "none"] },
          }
        : {
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
    // Bring the new table into view, caret in its first cell.
    const fig = this.shadowRoot?.querySelector<HTMLElement>(
      `article.folio-doc > [data-block-index="${String(idx)}"]`,
    );
    fig?.scrollIntoView({ block: "center" });
    fig?.querySelector<HTMLElement>("td[data-row-index]")?.focus();
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
    // Esc dismisses a code figure's open header early - the one
    // inspector contract (docs/specs/figure-inspectors.md). A drawn
    // figure's source hides with it, so the caret moves past it.
    if (ev.key === "Escape") {
      const at = this.caretPoint();
      const node =
        at && (at.node instanceof Element ? at.node : at.node.parentElement);
      const fig = node?.closest<HTMLElement>("figure.folio-codeblock");
      const bar = fig?.querySelector<HTMLElement>(":scope > .folio-inspector");
      if (fig && bar && !bar.hidden) {
        ev.preventDefault();
        bar.hidden = true;
        if (fig.classList.contains("folio-drawn")) {
          const idx = Number(fig.dataset.blockIndex ?? -1);
          const host = fig.closest("article.folio-doc");
          if (host && idx + 1 < host.children.length) {
            this.focusBlockStart(idx + 1);
          } else {
            (document.getSelection() as Selection | null)?.removeAllRanges();
          }
        }
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
    // Ctrl/Cmd+A in a code body selects the CODE, never the whole
    // document (where the next keystroke would replace everything).
    if (
      ev.key.toLowerCase() === "a" &&
      (ev.ctrlKey || ev.metaKey) &&
      !ev.altKey
    ) {
      const at = this.caretPoint()?.node ?? null;
      const host = at instanceof Element ? at : (at?.parentElement ?? null);
      const pre = host?.closest<HTMLElement>("pre.folio-code");
      if (pre) {
        ev.preventDefault();
        const root = this.shadowRoot as
          (ShadowRoot & { getSelection?: () => Selection | null }) | null;
        const sel =
          typeof root?.getSelection === "function"
            ? root.getSelection()
            : document.getSelection();
        sel?.setBaseAndExtent(pre, 0, pre, pre.childNodes.length);
        return;
      }
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
    // Lists: Backspace at the very START of an item removes its
    // bullet first - a nested item lifts a level, a top-level one
    // becomes a paragraph - like a word processor. Only a second
    // Backspace merges lines.
    if (
      ev.key === "Backspace" &&
      !ev.shiftKey &&
      !ev.ctrlKey &&
      !ev.metaKey &&
      !ev.altKey
    ) {
      const li = this.caretListItem();
      if (li && this.caretAtItemStart(li)) {
        ev.preventDefault();
        if (li.parentElement?.parentElement?.tagName === "LI") {
          this.outdentListItem();
        } else {
          this.liftOutOfList(li);
        }
        return;
      }
    }
    // Lists (spec: docs/specs/lists.md): Tab nests the caret's item,
    // Shift+Tab lifts it. Outside a list, Tab keeps its usual job.
    if (isTabKey(ev) && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const li = this.caretListItem();
      if (li) {
        ev.preventDefault();
        if (ev.shiftKey) this.outdentListItem();
        else this.indentListItem();
        return;
      }
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
    if (ev.key !== "Enter" && !isTabKey(ev)) return;
    if (isTabKey(ev) && ev.shiftKey && th.previousElementSibling === null) {
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
    if (!isTabKey(ev) && ev.key !== "Enter") return;
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
    if (!block || !INLINE_BLOCKS.has(block.tagName) || !block.isConnected) {
      return false;
    }
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
    menu.className = "folio-menu folio-table-menu";
    menu.setAttribute("role", "menu");
    const items: [string, TableAction][] = [
      ["Insert row below", "row-below"],
      ["Delete row", "delete-row"],
      ["Insert column right", "column-right"],
      ["Delete column", "delete-column"],
    ];
    for (const [label, action] of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "menuitem");
      btn.textContent = label;
      // The press must not reach the document (caret, inspectors).
      btn.addEventListener("mousedown", (ev) => ev.preventDefault());
      btn.addEventListener("click", () => {
        this.closeMenu();
        this.applyTableAction(block, r, c, action, figure);
      });
      menu.appendChild(btn);
    }
    // Outside the editable article (its handlers must not see the
    // menu), fixed at the pointer.
    menu.style.left = `${String(Math.min(x, window.innerWidth - 180))}px`;
    menu.style.top = `${String(Math.min(y, window.innerHeight - 170))}px`;
    root.appendChild(menu);
    this.menu = menu;
    setTimeout(() => {
      document.addEventListener("pointerdown", this.menuCloser, {
        once: true,
      });
    });
  }

  /**
   * One edit to a table's shape - from the context menu or the palette
   * ("Insert a column", ...). A formula column cannot be deleted this
   * way (other formulas may read it). Returns why not, or null.
   */
  private applyTableAction(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    r: number,
    c: number,
    action: TableAction,
    figure: HTMLElement,
  ): string | null {
    const t = block.table;
    switch (action) {
      case "row-below":
        t.rows.splice(
          r + 1,
          0,
          t.columns.map(() => ""),
        );
        break;
      case "delete-row":
        if (t.rows.length <= 1) return "A table keeps at least one row";
        t.rows.splice(r, 1);
        break;
      case "column-right": {
        const names = new Set(t.columns.map((col) => col.name.toLowerCase()));
        let name = "new";
        for (let i = 2; names.has(name); i++) name = `new_${String(i)}`;
        t.columns.splice(c + 1, 0, { name, type: "text" });
        t.rows.forEach((row) => row.splice(c + 1, 0, ""));
        break;
      }
      case "delete-column": {
        const col = t.columns[c];
        if (col?.type === "formula") {
          return "Delete a formula column from its inspector (other formulas may use it)";
        }
        if (t.columns.length <= 1) return "A table keeps at least one column";
        t.columns.splice(c, 1);
        t.rows.forEach((row) => row.splice(c, 1));
        break;
      }
    }
    this.refreshTableBlock(figure, block);
    this.emitChange();
    return null;
  }

  /**
   * The palette's table edits act on the table cell at the caret.
   * Returns why not, or null.
   */
  tableActionAtCaret(action: TableAction): string | null {
    const at = this.caretPoint();
    const el =
      at && (at.node instanceof Element ? at.node : at.node.parentElement);
    const cell = el?.closest<HTMLElement>(
      "td[data-row-index], th[data-col-index], td",
    );
    const figure = cell?.closest<HTMLElement>("figure[data-table-id]");
    const block =
      figure && this.doc?.blocks[Number(figure.dataset.blockIndex ?? -1)];
    if (!cell || !figure || block?.kind !== "table") {
      return "Click into a table cell first";
    }
    const tr = cell.closest<HTMLElement>("tr");
    const r = Number(tr?.dataset.rowIndex ?? cell.dataset.rowIndex ?? 0);
    const c = Number(
      cell.dataset.colIndex ?? (cell as HTMLTableCellElement).cellIndex,
    );
    return this.applyTableAction(block, r, c, action, figure);
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
