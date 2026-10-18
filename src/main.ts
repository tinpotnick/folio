/**
 * Demo host app (ADR-0006: our apps are hosts of the component).
 * Document view / Markdown view toggle; edits in either mode keep
 * the document as the source of truth.
 */
import "./component.js";
import type { FolioDoc } from "./component.js";
import { parseDoc, serializeDoc } from "./engine/doc.js";
import { highlightMarkdown } from "./render/highlight.js";
import { isDesktop, openDocument, saveDocument } from "./desktop.js";

function requireEl<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing element: ${selector}`);
  return el;
}

const el = requireEl<FolioDoc>("#the-doc");
const editor = requireEl<HTMLTextAreaElement>("#editor");
const btnView = requireEl<HTMLButtonElement>("#btn-view");
const btnMd = requireEl<HTMLButtonElement>("#btn-markdown");
const status = requireEl<HTMLElement>("#status");
const sidebar = requireEl<HTMLElement>("#sidebar");
const outlineBox = requireEl<HTMLElement>("#outline");
const mdWrap = requireEl<HTMLElement>("#md-wrap");
const mdGutter = requireEl<HTMLElement>("#md-gutter");
const mdView = requireEl<HTMLElement>("#md-view");

async function boot(): Promise<void> {
  const res = await fetch("/demo/sample-document.md");
  const text = await res.text();
  await el.load(text);
  editor.value = text;
  refreshOutline();
}

function flash(msg: string): void {
  status.textContent = msg;
  status.classList.add("show");
  setTimeout(() => status.classList.remove("show"), 1200);
}

function renderHighlight(): void {
  const lines = highlightMarkdown(editor.value);
  editor.style.height = "auto";
  editor.style.height = `${String(editor.scrollHeight)}px`;
  mdView.textContent = "";
  lines.forEach((line) => {
    const ln = document.createElement("span");
    ln.className = "ln";
    if (line.tokens.length === 0) {
      ln.textContent = "\u00a0";
    } else {
      for (const tok of line.tokens) {
        const span = document.createElement("span");
        span.className = `tk-${tok.kind}`;
        span.textContent = tok.text;
        ln.appendChild(span);
      }
    }
    mdView.appendChild(ln);
  });
  mdGutter.textContent = "";
  lines.forEach((_, i) => {
    mdGutter.appendChild(document.createTextNode(`${String(i + 1)}\n`));
  });
}

btnView.addEventListener("click", () => {
  if (!editor.hidden) {
    try {
      const doc = parseDoc(editor.value);
      el.load(serializeDoc(doc));
      flash("Parsed OK");
    } catch (e) {
      flash(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
  }
  editor.hidden = true;
  mdWrap.hidden = true;
  el.hidden = false;
  btnView.classList.add("active");
  btnMd.classList.remove("active");
  refreshOutline();
});

btnMd.addEventListener("click", () => {
  const md = el.getMarkdown();
  if (md !== null) editor.value = md;
  el.hidden = true;
  editor.hidden = false;
  mdWrap.hidden = false;
  renderHighlight();
  btnMd.classList.add("active");
  btnView.classList.remove("active");
});

function currentEditable(): HTMLElement | null {
  const root = el.shadowRoot;
  if (!root) return null;
  const host = root.querySelector<HTMLElement>("article.folio-doc");
  if (!host) return null;
  return host.contains(root.activeElement) ? host : null;
}

type ShadowRootWithSelection = ShadowRoot & {
  getSelection?: () => Selection | null;
};

type SelectionWithComposedRanges = Selection & {
  getComposedRanges?: () => { startContainer: Node }[];
};

/**
 * The caret anchor inside the document article, robust across
 * engines. Chromium's document-level selection is adjusted to the
 * light DOM when the caret is in the shadow root, and WebKitGTK
 * exposes NO selection or caret API that pierces the shadow
 * boundary at all (shadowRoot.getSelection is missing there;
 * getComposedRanges, caretRangeFromPoint, and caretPositionFromPoint
 * all return shadow-boundary-retargeted nodes — verified against
 * WebKitGTK 2.54, the Tauri engine). What does pierce in WebKit is
 * the shadow root's own hit testing, so for pointer-driven updates
 * elementFromPoint on the shadow root resolves the inner element.
 */
function docSelectionAnchor(
  host: HTMLElement,
  point?: { x: number; y: number },
): Node | null {
  const inside = (n: Node | null): Node | null =>
    n !== null && host.contains(n) ? n : null;
  const root = el.shadowRoot as ShadowRootWithSelection | null;
  const shadowSel = root?.getSelection?.();
  const shadowAnchor = inside(shadowSel?.anchorNode ?? null);
  if (shadowAnchor !== null) return shadowAnchor;
  const docSel = document.getSelection();
  const docAnchor = inside(docSel?.anchorNode ?? null);
  if (docAnchor !== null) return docAnchor;
  // Selection.getComposedRanges() pierces shadow roots where present.
  for (const r of (
    docSel as SelectionWithComposedRanges | null
  )?.getComposedRanges?.() ?? []) {
    const n = inside(r.startContainer);
    if (n !== null) return n;
  }
  if (point) {
    const hit = inside(root?.elementFromPoint(point.x, point.y) ?? null);
    if (hit !== null) return hit;
  }
  return null;
}

const blockBar = requireEl<HTMLElement>("#block-bar");
blockBar.addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;
  ev.preventDefault();
  if (currentEditable()) {
    if (btn.dataset.block) {
      document.execCommand("formatBlock", false, `<${btn.dataset.block}>`);
    }
    el.dispatchEvent(new Event("input"));
  } else if (document.activeElement === editor) {
    applyMdLinePrefix(
      btn.dataset.block === "h1" ? "#" : btn.dataset.block === "h2" ? "##" : "",
    );
  } else {
    flash("Click into the text first");
  }
});

const fmtBar = requireEl<HTMLElement>("#fmt-bar");
fmtBar.addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;
  ev.preventDefault();
  const cmd = btn.dataset.cmd ?? "";
  const mark =
    cmd === "bold"
      ? "**"
      : cmd === "italic"
        ? "*"
        : cmd === "strike"
          ? "~~"
          : cmd === "underline"
            ? "++"
            : "`";
  if (currentEditable()) {
    if (cmd === "strike") {
      document.execCommand("strikeThrough");
    } else {
      document.execCommand(cmd);
    }
  } else if (document.activeElement === editor) {
    toggleMdWrap(mark);
  } else {
    flash("Click into the text first");
  }
});

/* --- Insert group: table, diagram, code block --- */

const btnDiagram = requireEl<HTMLButtonElement>("#btn-diagram");
// mousedown (like the format buttons) so the button press never
// steals focus from the document before the action runs.
btnDiagram.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  if (currentEditable()) {
    el.insertDiagram();
    flash("Diagram inserted");
    return;
  }
  if (document.activeElement !== editor) {
    flash("Click into the text first");
    return;
  }
  wrapMdLines("::: mermaid {#diagram-new}\n", "\n:::");
  flash("Diagram inserted");
});

const btnCodeBlock = requireEl<HTMLButtonElement>("#btn-code");
btnCodeBlock.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  if (currentEditable()) {
    el.toggleCodeBlock();
    return;
  }
  if (document.activeElement !== editor) {
    flash("Click into the text first");
    return;
  }
  wrapMdLines("```\n", "\n```");
});

/**
 * Fence the caret's whole paragraph (blank-line delimited) with the
 * given open/close markers - a physical line alone can split a
 * wrapped prose block.
 */
function wrapMdLines(open: string, close: string): void {
  const v = editor.value;
  const caret = editor.selectionStart;
  const [start0, end0] = mdLineBounds(caret);
  const lineEmpty = (s: number, e: number): boolean =>
    v.slice(s, e).trim() === "";
  let start = start0;
  while (start > 0) {
    const prev = mdLineBounds(start - 1);
    if (lineEmpty(prev[0], prev[1])) break;
    start = prev[0];
  }
  let end = end0;
  while (end < v.length) {
    const next = mdLineBounds(end + 1);
    if (lineEmpty(next[0], next[1])) break;
    end = next[1];
  }
  editor.value =
    v.slice(0, start) + open + v.slice(start, end) + close + v.slice(end);
  editor.setSelectionRange(start + open.length, start + open.length);
  renderHighlight();
  reflectToolbarState();
}

function reflectToolbarState(point?: { x: number; y: number }): void {
  const inDoc = currentEditable() !== null;
  const inMd = document.activeElement === editor;
  const blockButtons = blockBar.querySelectorAll("button");
  const fmtButtons = fmtBar.querySelectorAll("button");
  if (!inDoc && !inMd) {
    blockButtons.forEach((b) => b.classList.remove("active"));
    fmtButtons.forEach((b) => {
      b.classList.remove("active");
      b.disabled = false;
    });
    return;
  }
  if (inDoc) {
    const root = el.shadowRoot;
    const host = root?.querySelector<HTMLElement>("article.folio-doc") ?? null;
    let node: Node | null = host ? docSelectionAnchor(host, point) : null;
    // Engines that cannot resolve the inner caret at all (WebKitGTK,
    // on keyboard navigation) keep the last shown state rather than
    // blanking the toolbar.
    if (node === null) return;
    // Semantic, markdown-true inline detection: walk the ancestors for
    // STRONG/EM/CODE. queryCommandState reports rendered boldness
    // (headings render bold), which lit B on H1 lines and differs
    // between engines.
    let inline: string | null = null;
    while (node && node.parentNode && node.parentNode !== host) {
      if (!inline) {
        const name = node.nodeName;
        if (name === "STRONG") inline = "bold";
        else if (name === "EM") inline = "italic";
        else if (name === "CODE") inline = "code";
        else if (name === "DEL") inline = "strike";
        else if (name === "INS") inline = "underline";
      }
      node = node.parentNode;
    }
    const tag = node instanceof HTMLElement ? node.tagName : "";
    blockButtons.forEach((b) => {
      const want =
        b.dataset.block === "p" ? "P" : (b.dataset.block ?? "").toUpperCase();
      b.classList.toggle("active", tag === want);
    });
    // Headings and code blocks are complete block formats: the
    // markdown carries no inline emphasis inside them, so the inline
    // buttons neither light up nor act there.
    const noInline = /^H[1-6]$/.test(tag) || tag === "PRE";
    fmtButtons.forEach((b) => {
      const cmd = b.dataset.cmd ?? "";
      b.disabled = noInline;
      b.classList.toggle("active", !noInline && cmd === inline);
    });
    btnCodeBlock.classList.toggle("active", tag === "PRE");
    return;
  }
  // Markdown source view: derive state from the caret position.
  const v = editor.value;
  const pos = editor.selectionStart;
  const [lineStart, lineEnd] = mdLineBounds(pos);
  const line = v.slice(lineStart, lineEnd);
  const col = pos - lineStart;
  let block = "p";
  if (line.startsWith("## ")) block = "h2";
  else if (line.startsWith("# ")) block = "h1";
  blockButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.block === block),
  );
  const mdLine = highlightMarkdown(line)[0];
  let fmt: string | null = null;
  let acc = 0;
  for (const tok of mdLine?.tokens ?? []) {
    const tokEnd = acc + tok.text.length;
    if (col >= acc && col <= tokEnd) {
      if (
        tok.kind === "bold" ||
        tok.kind === "italic" ||
        tok.kind === "strike" ||
        tok.kind === "underline"
      ) {
        fmt = tok.kind;
      }
      break;
    }
    acc = tokEnd;
  }
  // Inline toggles do not apply on heading lines — same rule as in
  // document view.
  const noInline = line.startsWith("#");
  // The code-block button reflects fence state at the caret.
  let fenceCount = 0;
  for (let i = 0; i < lineStart; i++) {
    if (v[i] === "`" && v[i + 1] === "`" && v[i + 2] === "`") {
      fenceCount += 1;
      i += 2;
    }
  }
  btnCodeBlock.classList.toggle("active", fenceCount % 2 === 1);
  fmtButtons.forEach((b) => {
    const cmd = b.dataset.cmd ?? "";
    b.disabled = noInline;
    b.classList.toggle("active", !noInline && cmd !== "" && cmd === fmt);
  });
}

/* --- Caret hint: arrow-key tracking for engines without a pierceable
   selection API (WebKitGTK). Clicks resolve the block exactly; arrows
   move across the article's block elements using their own geometry
   (block rects and the first line box are readable through the open
   shadow root, unlike the caret itself). Chromium ignores the hint —
   its shadow selection is read directly. --- */

let caretHint: { x: number; y: number } | null = null;
let caretBlock: HTMLElement | null = null;

function blockAtPoint(x: number, y: number): HTMLElement | null {
  const root = el.shadowRoot;
  const article = root?.querySelector<HTMLElement>("article.folio-doc") ?? null;
  const hit = root?.elementFromPoint(x, y) ?? null;
  if (!article || !hit) return null;
  let node: Node | null = hit;
  while (node && node.parentNode !== article) node = node.parentNode;
  return node instanceof HTMLElement ? node : null;
}

function firstLineHeight(block: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(block);
  const rect = range.getClientRects()[0];
  return rect ? rect.height : 20;
}

document.addEventListener("selectionchange", () => {
  const root = el.shadowRoot;
  if (root?.activeElement?.tagName === "ARTICLE") {
    setTimeout(() => reflectToolbarState(caretHint ?? undefined), 0);
  }
});
el.addEventListener("pointerup", (ev) =>
  setTimeout(() => {
    const p =
      ev instanceof PointerEvent ? { x: ev.clientX, y: ev.clientY } : undefined;
    caretHint = p ?? caretHint;
    if (p) caretBlock = blockAtPoint(p.x, p.y);
    reflectToolbarState(p);
  }, 0),
);
el.addEventListener("keyup", (ev) =>
  setTimeout(() => {
    if (
      ev instanceof KeyboardEvent &&
      (ev.key === "ArrowUp" || ev.key === "ArrowDown") &&
      caretHint !== null
    ) {
      if (caretBlock === null) {
        caretBlock = blockAtPoint(caretHint.x, caretHint.y);
      }
      if (caretBlock !== null) {
        const lh = firstLineHeight(caretBlock);
        const rect = caretBlock.getBoundingClientRect();
        const onFirstLine = caretHint.y - rect.top <= lh;
        const onLastLine = rect.bottom - caretHint.y <= lh;
        if (ev.key === "ArrowUp" && onFirstLine) {
          const prev = caretBlock.previousElementSibling;
          if (prev instanceof HTMLElement) {
            caretBlock = prev;
            caretHint = {
              x: caretHint.x,
              y: prev.getBoundingClientRect().bottom - 6,
            };
          }
        } else if (ev.key === "ArrowDown" && onLastLine) {
          const next = caretBlock.nextElementSibling;
          if (next instanceof HTMLElement) {
            caretBlock = next;
            caretHint = {
              x: caretHint.x,
              y: next.getBoundingClientRect().top + 6,
            };
          }
        } else {
          const step = Math.max(lh, 8);
          caretHint = {
            x: caretHint.x,
            y:
              ev.key === "ArrowUp"
                ? Math.max(rect.top + 4, caretHint.y - step)
                : Math.min(rect.bottom - 4, caretHint.y + step),
          };
        }
      }
    }
    reflectToolbarState(caretHint ?? undefined);
  }, 0),
);
editor.addEventListener("keyup", () => setTimeout(reflectToolbarState, 0));
editor.addEventListener("click", () => setTimeout(reflectToolbarState, 0));
editor.addEventListener("input", () => {
  renderHighlight();
  reflectToolbarState();
});

/* --- Markdown-view toolbar actions (spec: docs/specs/toolbar-context.md) --- */

function mdLineBounds(pos: number): [number, number] {
  const v = editor.value;
  const start = v.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const nl = v.indexOf("\n", start);
  return [start, nl < 0 ? v.length : nl];
}

function applyMdLinePrefix(prefix: string): void {
  const v = editor.value;
  const caret = editor.selectionStart;
  const [start, end] = mdLineBounds(caret);
  const stripped = v.slice(start, end).replace(/^#{1,6}\s+/, "");
  const line = prefix === "" ? stripped : `${prefix} ${stripped}`;
  editor.value = v.slice(0, start) + line + v.slice(end);
  const delta = line.length - (end - start);
  editor.setSelectionRange(caret + delta, caret + delta);
  renderHighlight();
  reflectToolbarState();
}

function wordRangeAt(v: string, pos: number): [number, number] {
  const edge = (c: string | undefined): boolean =>
    c !== undefined && /[\w'-]/.test(c);
  let s = pos;
  let e = pos;
  while (edge(v[s - 1])) s -= 1;
  while (edge(v[e])) e += 1;
  return [s, e];
}

function toggleMdWrap(mark: string): void {
  const v = editor.value;
  let s = editor.selectionStart;
  let e = editor.selectionEnd;
  if (s === e) {
    const [ws, we] = wordRangeAt(v, s);
    if (ws === we) return;
    s = ws;
    e = we;
  }
  const len = mark.length;
  const wrapped =
    v.slice(Math.max(0, s - len), s) === mark && v.slice(e, e + len) === mark;
  if (wrapped) {
    editor.value = v.slice(0, s - len) + v.slice(s, e) + v.slice(e + len);
    editor.setSelectionRange(s - len, e - len);
  } else {
    editor.value = v.slice(0, s) + mark + v.slice(s, e) + mark + v.slice(e);
    editor.setSelectionRange(s + len, e + len);
  }
  renderHighlight();
  reflectToolbarState();
}

const btnTable = requireEl<HTMLButtonElement>("#btn-table");
btnTable.addEventListener("click", () => {
  el.insertTable();
  flash("Table inserted");
});

el.onChange(() => {
  const md = el.getMarkdown();
  if (md !== null) editor.value = md;
});

boot();

/* --- Section browser (left sidebar) --- */

function refreshOutline(): void {
  const outline = el.getOutline();
  outlineBox.textContent = "";
  if (outline.length === 0) {
    sidebar.hidden = true;
    return;
  }
  for (const entry of outline) {
    const btn = document.createElement("button");
    btn.className = `l${String(entry.level)}`;
    btn.textContent = entry.text || "(untitled)";
    btn.title = entry.text;
    btn.dataset.blockIndex = String(entry.blockIndex);
    btn.addEventListener("click", () => {
      if (!editor.hidden) {
        try {
          el.load(serializeDoc(parseDoc(editor.value)));
        } catch {
          flash("Fix parse errors first");
          return;
        }
        editor.hidden = true;
        mdWrap.hidden = true;
        el.hidden = false;
        btnView.classList.add("active");
        btnMd.classList.remove("active");
      }
      el.revealBlock(entry.blockIndex);
    });
    outlineBox.appendChild(btn);
  }
  reflectActiveSection();
}

function reflectActiveSection(): void {
  if (!editor.hidden) return;
  const first = el.firstVisibleBlockIndex();
  const outline = el.getOutline();
  let activeIdx = -1;
  outline.forEach((entry, i) => {
    if (entry.blockIndex <= first) activeIdx = i;
  });
  outlineBox.querySelectorAll("button").forEach((btn, i) => {
    btn.classList.toggle("active", i === activeIdx);
  });
}

window.addEventListener("scroll", reflectActiveSection, { passive: true });
window.addEventListener("resize", reflectActiveSection, { passive: true });

const btnSidebar = requireEl<HTMLButtonElement>("#btn-sidebar");
btnSidebar.addEventListener("click", () => {
  sidebar.hidden = !sidebar.hidden;
});

/* --- Desktop (Tauri) bridge: native Open/Save (ADR-0006) --- */

const btnOpen = requireEl<HTMLButtonElement>("#btn-open");
const btnSave = requireEl<HTMLButtonElement>("#btn-save");

if (isDesktop()) {
  btnOpen.hidden = false;
  btnSave.hidden = false;
}

btnOpen.addEventListener("click", async () => {
  const text = await openDocument();
  if (text === null) return;
  await el.load(text);
  editor.value = text;
  refreshOutline();
  flash("Opened document");
});

btnSave.addEventListener("click", async () => {
  const md = el.getMarkdown();
  if (md === null) return;
  const path = await saveDocument(md);
  if (path !== null) flash(`Saved ${path}`);
});

/* --- In-app help (spec: docs/specs/in-app-help.md) --- */

const btnHelp = requireEl<HTMLButtonElement>("#btn-help");
const helpModal = requireEl<HTMLDialogElement>("#help-modal");

function openHelp(): void {
  if (!helpModal.open) helpModal.showModal();
}

btnHelp.addEventListener("click", openHelp);
requireEl<HTMLButtonElement>("#btn-help-close").addEventListener(
  "click",
  () => {
    helpModal.close();
  },
);

document.addEventListener("keydown", (ev) => {
  if (ev.key !== "?" && ev.key !== "F1") return;
  const a = document.activeElement;
  const editable = (node: Element | null | undefined): boolean =>
    node instanceof HTMLElement &&
    (node.isContentEditable ||
      node.tagName === "TEXTAREA" ||
      node.tagName === "INPUT");
  // The document's editable surface lives in the component's shadow
  // root; activeElement then resolves to the host, so pierce it.
  if (editable(a) || editable(a?.shadowRoot?.activeElement)) return;
  ev.preventDefault();
  openHelp();
});

refreshOutline();
