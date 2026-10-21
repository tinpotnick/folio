/**
 * Demo host app (ADR-0006: our apps are hosts of the component).
 * Document view / Markdown view toggle; edits in either mode keep
 * the document as the source of truth.
 */
import "./component.js";
import type { FolioDoc } from "./component.js";
import { parseDoc, serializeDoc } from "./engine/doc.js";
import { importedTable, parseImport } from "./engine/ingest.js";
import type { Table } from "./engine/index.js";
import { highlightMarkdown } from "./render/highlight.js";
import {
  PALETTES,
  TABLE_STYLES,
  presetTheme,
  themeInfo,
  themeNames,
} from "./render/theme.js";
import { BUNDLED_FONTS } from "./render/fonts.js";
import {
  isDesktop,
  openDocument,
  saveDocument,
  saveTextFile,
} from "./desktop.js";

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

/** The front page: what folio is, what it does, the examples. */
const WELCOME = "/demo/welcome.md";

/**
 * The document to boot into (spec: docs/specs/welcome-page.md): the
 * welcome page, or a shipped document named by `?doc=` - a link that
 * opens folio on an example. Only same-origin `.md` paths; anything
 * else falls back to the welcome page.
 */
function bootPath(): string {
  const doc = new URLSearchParams(window.location.search).get("doc");
  if (doc && /^\/?[\w./-]+\.md$/.test(doc) && !doc.includes("..")) {
    return doc.startsWith("/") ? doc : `/${doc}`;
  }
  return WELCOME;
}

async function boot(): Promise<void> {
  await openShipped(bootPath(), { history: "replace" });
}

/** The address bar for a shipped document: home is the bare URL. */
function docUrl(path: string): string {
  return path === WELCOME ? window.location.pathname : `?doc=${path.slice(1)}`;
}

/**
 * Load a shipped document by path into the editor (in place). It
 * opens at its TOP, and it becomes a browser history entry: Back
 * returns to the previous document instead of leaving folio.
 */
async function openShipped(
  path: string,
  opts: { history?: "push" | "replace" | "none"; scroll?: number } = {},
): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  const text = await res.text();
  const mode = opts.history ?? "push";
  // Remember where the reader was on the page they are leaving, so
  // Back returns them there - not to its top.
  if (mode === "push") {
    history.replaceState(
      { ...(history.state as object | null), scroll: window.scrollY },
      "",
    );
  }
  currentDocPath = null; // an in-memory doc has no folder
  await el.load(text);
  editor.value = text;
  if (!mdWrap.hidden) renderHighlight();
  refreshOutline();
  // No caret in the new document: no block or format is "current".
  for (const b of Array.from(
    document.querySelectorAll("#block-bar button, #fmt-bar button"),
  )) {
    b.classList.remove("active");
  }
  window.scrollTo(0, opts.scroll ?? 0);
  if (mode === "push") history.pushState({ doc: path }, "", docUrl(path));
  if (mode === "replace") history.replaceState({ doc: path }, "", docUrl(path));
}

window.addEventListener("popstate", (ev) => {
  const scroll = (ev.state as { scroll?: number } | null)?.scroll ?? 0;
  void openShipped(bootPath(), { history: "none", scroll });
});

let flashTimer: ReturnType<typeof setTimeout> | undefined;

function flash(msg: string): void {
  status.textContent = msg;
  status.classList.add("show");
  // Long messages (a reason, a result) stay up long enough to read.
  clearTimeout(flashTimer);
  flashTimer = setTimeout(
    () => status.classList.remove("show"),
    Math.max(1200, msg.length * 60),
  );
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
      // Markdown-view edits are one undo step in document view.
      el.load(serializeDoc(doc), { keepHistory: true });
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
  getComposedRanges?: (...roots: unknown[]) => { startContainer: Node }[];
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
  // Selection.getComposedRanges() pierces shadow roots - but only the
  // ones it is GIVEN: called bare, WebKit reports the caret on the
  // host element, and the toolbar went stale after every keystroke
  // in the desktop app.
  const composed = (): { startContainer: Node }[] => {
    const s = docSel as SelectionWithComposedRanges | null;
    if (!s?.getComposedRanges || !root) return [];
    try {
      return s.getComposedRanges({ shadowRoots: [root] });
    } catch {
      return s.getComposedRanges(root);
    }
  };
  for (const r of composed()) {
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

/** Run a block-bar button as if pressed (palette: one implementation). */
function clickBlockButton(block: string): void {
  blockBar
    .querySelector(`button[data-block="${block}"]`)
    ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}
blockBar.addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;
  ev.preventDefault();
  if (currentEditable()) {
    const block = btn.dataset.block;
    if (block === "ul" || block === "ol") {
      // Spec: docs/specs/lists.md.
      el.toggleList(block === "ol");
    } else if (block) {
      // Model-level conversion: execCommand cannot act inside the
      // shadow tree.
      el.setBlockKind(block as "h1" | "h2" | "h3" | "p");
    }
  } else if (document.activeElement === editor) {
    const block = btn.dataset.block;
    applyMdLinePrefix(
      block === "h1"
        ? "#"
        : block === "h2"
          ? "##"
          : block === "h3"
            ? "###"
            : block === "ul"
              ? "-"
              : block === "ol"
                ? "1."
                : "",
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
    const tag =
      cmd === "bold"
        ? "strong"
        : cmd === "italic"
          ? "em"
          : cmd === "strike"
            ? "del"
            : "ins";
    if (!el.applyInlineFormat(tag)) {
      flash("Select some text first");
    }
  } else if (document.activeElement === editor) {
    toggleMdWrap(mark);
  } else {
    flash("Click into the text first");
  }
});

/* --- Links (spec: docs/specs/links.md) --- */

const btnLink = requireEl<HTMLButtonElement>("#btn-link");
btnLink.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  if (currentEditable()) {
    if (!el.linkButtonAction()) flash("Click into the text first");
    return;
  }
  if (document.activeElement !== editor) {
    flash("Click into the text first");
    return;
  }
  // Markdown view: wrap the selection (or insert a template).
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const sel = editor.value.slice(start, end) || "link text";
  const md = `[${sel}](url)`;
  editor.setRangeText(md, start, end, "end");
  editor.dispatchEvent(new Event("input", { bubbles: true }));
});

/**
 * Follow a document link: .md paths load in place (the same path
 * the examples use); anything with a protocol opens in a new tab.
 * A failed fetch is a visible message, never a broken document.
 */
async function openLinkedDocument(href: string): Promise<void> {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href)) {
    window.open(href, "_blank", "noopener");
    return;
  }
  try {
    const url = new URL(href, window.location.href);
    if (!url.pathname.endsWith(".md")) {
      window.open(href, "_blank", "noopener");
      return;
    }
    await openShipped(url.pathname);
    flash("Opened linked document");
  } catch {
    flash(`Could not open ${href}`);
  }
}

// Files the document exports (a model's STL): a native save dialog on
// the desktop, a download on the web.
el.addEventListener("folio-export", (ev) => {
  const d = (
    ev as CustomEvent<{ filename: string; mime: string; text: string }>
  ).detail;
  if (!d) return;
  if (isDesktop()) {
    void saveTextFile(d.text, d.filename, "STL model").then((path) => {
      if (path) flash(`Saved ${path}`);
    });
    return;
  }
  const url = URL.createObjectURL(new Blob([d.text], { type: d.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = d.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash(`Downloaded ${d.filename}`);
});

// The component's own short results ("Now a dataset ...").
el.addEventListener("folio-status", (ev) => {
  const message = (ev as CustomEvent<{ message: string }>).detail?.message;
  if (message) flash(message);
});

el.addEventListener("folio-link", (ev) => {
  const href = (ev as CustomEvent<{ href: string }>).detail?.href;
  if (href) void openLinkedDocument(href);
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

const btnEquation = requireEl<HTMLButtonElement>("#btn-equation");
// mousedown (like the other insert buttons) so the press never
// steals focus from the document before the action runs.
btnEquation.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  if (currentEditable()) {
    el.insertMath();
    flash("Equation inserted");
    return;
  }
  if (document.activeElement !== editor) {
    flash("Click into the text first");
    return;
  }
  wrapMdLines("$$\n", "\n$$");
  flash("Equation inserted");
});

const btnImage = requireEl<HTMLButtonElement>("#btn-image");
const imageFile = requireEl<HTMLInputElement>("#image-file");
// A folio document is ONE file (ADR-0005): images embed as data
// URIs, so a sane ceiling keeps the Markdown source workable.
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

// mousedown (like the other insert buttons) so the press never
// steals focus from the document before the action runs.
btnImage.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  imageFile.click();
});

imageFile.addEventListener("change", () => {
  const f = imageFile.files?.[0];
  imageFile.value = "";
  if (!f) return;
  if (f.size > IMAGE_MAX_BYTES) {
    flash("Image too large (over 8 MB) - the document stays one file");
    return;
  }
  const reader = new FileReader();
  reader.onload = (): void => {
    if (typeof reader.result !== "string") return;
    // The file name is a better first alt than nothing.
    const alt = f.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    el.insertImage(reader.result, alt === "" ? undefined : alt);
    flash("Image inserted");
  };
  reader.readAsDataURL(f);
});

const btnAudio = requireEl<HTMLButtonElement>("#btn-audio");
const audioFile = requireEl<HTMLInputElement>("#audio-file");
// Same single-file ceiling as images: a data URI makes the sound
// travel inside the document (ADR-0005), so keep it sane.
const AUDIO_MAX_BYTES = 8 * 1024 * 1024;

btnAudio.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  audioFile.click();
});

audioFile.addEventListener("change", () => {
  const f = audioFile.files?.[0];
  audioFile.value = "";
  if (!f) return;
  if (f.size > AUDIO_MAX_BYTES) {
    flash("Audio too large (over 8 MB) - the document stays one file");
    return;
  }
  const reader = new FileReader();
  reader.onload = (): void => {
    if (typeof reader.result !== "string") return;
    // The file name is a better first alt than nothing.
    const alt = f.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    el.insertAudio(reader.result, alt === "" ? undefined : alt);
    flash("Audio inserted");
  };
  reader.readAsDataURL(f);
});

/* --- Record audio from the microphone (spec: audio-embeds.md) ---
 * A recording is just another INPUT PATH for an audio block:
 * getUserMedia + MediaRecorder are browser APIs (no dependency,
 * ADR-0007), and the clip lands in the document as a data URI
 * through the same insertAudio() the file picker uses. The
 * model, the parser, and the theme do not change at all. */
const btnRecord = requireEl<HTMLButtonElement>("#btn-record");
let recStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let recChunks: Blob[] = [];
let recStartedAt = 0;
let recTick: number | undefined;
// Opus lands at roughly 180 KB per minute, so three minutes sits
// comfortably under the 8 MB single-file ceiling.
const RECORD_MAX_MS = 3 * 60 * 1000;

function cleanupRecording(): void {
  if (recTick !== undefined) {
    clearInterval(recTick);
    recTick = undefined;
  }
  recStream?.getTracks().forEach((t) => t.stop());
  recStream = null;
  recorder = null;
  recChunks = [];
  btnRecord.classList.remove("rec");
}

function stopRecording(): void {
  const rec = recorder;
  if (rec && rec.state !== "inactive") rec.stop();
  else cleanupRecording();
}

async function startRecording(): Promise<void> {
  if (
    typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    flash("Recording is not supported in this browser");
    return;
  }
  if (recorder !== null) {
    stopRecording();
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    flash("Microphone unavailable or permission denied");
    return;
  }
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined);
  } catch {
    cleanupRecording();
    flash("Recording could not start");
    return;
  }
  recorder = rec;
  recChunks = [];
  rec.ondataavailable = (ev: BlobEvent): void => {
    if (ev.data.size > 0) recChunks.push(ev.data);
  };
  rec.onstop = (): void => {
    const type = rec.mimeType || "audio/webm";
    const seconds = Math.max(1, Math.round((Date.now() - recStartedAt) / 1000));
    // Snapshot the chunks BEFORE cleanup - cleanupRecording resets
    // the accumulator, and an empty blob would read "nothing".
    const chunks = recChunks;
    cleanupRecording();
    const blob = new Blob(chunks, { type });
    if (blob.size === 0) {
      flash("Nothing recorded");
      return;
    }
    if (blob.size > AUDIO_MAX_BYTES) {
      flash("Recording too long (over 8 MB) - the document stays one file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (): void => {
      if (typeof reader.result !== "string") return;
      el.insertAudio(reader.result, "recording");
      flash(
        `Recorded ${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`,
      );
    };
    reader.readAsDataURL(blob);
  };
  rec.start(250);
  recStartedAt = Date.now();
  btnRecord.classList.add("rec");
  recTick = window.setInterval((): void => {
    const elapsed = Date.now() - recStartedAt;
    const secs = Math.floor(elapsed / 1000);
    status.textContent = `Recording ${String(Math.floor(secs / 60))}:${String(secs % 60).padStart(2, "0")} - click the mic to stop`;
    status.classList.add("show");
    if (elapsed >= RECORD_MAX_MS) stopRecording();
  }, 500);
}

function toggleRecording(): void {
  if (recorder !== null) stopRecording();
  else void startRecording();
}

// mousedown (like the other insert buttons) so the press never
// steals focus from the document before the action runs.
btnRecord.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  toggleRecording();
});

/* --- Import data from a file (CSV / JSON) --- */

const importFile = requireEl<HTMLInputElement>("#import-file");
const IMPORT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * A file name becomes a table id: identifier-legal so formulas and
 * cross-table references can use it, and unique within the
 * document.
 */
function tableIdFromFileName(
  name: string,
  doc: ReturnType<typeof el.getDoc>,
): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const stem = base === "" || /^[0-9]/.test(base) ? `imported_${base}` : base;
  const ids = new Set(
    (doc?.blocks ?? [])
      .filter((b) => b.kind === "table")
      .map((b) => (b.kind === "table" ? b.table.id : "")),
  );
  let id = stem;
  let n = 2;
  while (ids.has(id)) {
    id = `${stem}_${String(n)}`;
    n += 1;
  }
  return id;
}

importFile.addEventListener("change", () => {
  const f = importFile.files?.[0];
  importFile.value = "";
  if (!f) return;
  if (f.size > IMPORT_MAX_BYTES) {
    flash("File too large (over 8 MB) - the document stays one file");
    return;
  }
  const format = f.name.toLowerCase().endsWith(".json") ? "json" : "csv";
  const reader = new FileReader();
  reader.onload = (): void => {
    if (typeof reader.result !== "string") return;
    let table: Table;
    try {
      table = importedTable(
        tableIdFromFileName(f.name, el.getDoc()),
        parseImport(reader.result, format),
        f.name,
      );
    } catch (e) {
      flash(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    el.insertImportedTable(table);
    flash(
      `Imported ${table.rows.length.toLocaleString()} rows into @${table.id}`,
    );
  };
  reader.readAsText(f);
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
const btnStrudel = requireEl<HTMLButtonElement>("#btn-strudel");
// mousedown (like the other insert buttons) so the press never
// steals focus from the document before the action runs.
btnStrudel.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  if (currentEditable()) {
    el.insertStrudel();
    flash("Strudel music block inserted");
    return;
  }
  if (document.activeElement !== editor) {
    flash("Click into the text first");
    return;
  }
  wrapMdLines("```strudel\n", "\n```\n");
  flash("Strudel music block inserted");
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

/** The last click was on a figure (not text): nothing is "current"
 * until the next click in text or keystroke. */
let onFigure = false;
el.addEventListener("keydown", () => {
  onFigure = false;
});
// Decided at pointerDOWN, before a revealed bar can move anything.
el.addEventListener(
  "pointerdown",
  (ev) => {
    const hit = el.shadowRoot?.elementFromPoint(ev.clientX, ev.clientY) ?? null;
    onFigure = !!(hit?.closest("figure") && !hit.closest("pre, td, th"));
  },
  true,
);

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
    // A click on a FIGURE (a chart, its caption, a table's frame) puts
    // no caret in text: no block or format is "current". The engine
    // otherwise leaves the selection at the document's start, which
    // lit H1 for a click on a chart caption.
    if (onFigure) {
      blockButtons.forEach((b) => b.classList.remove("active"));
      fmtButtons.forEach((b) => b.classList.remove("active"));
      return;
    }
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
    // The INNERMOST list around the caret: in a sub-list, the list
    // buttons reflect (and act on) that sub-list.
    let innerList: string | null = null;
    while (node && node.parentNode && node.parentNode !== host) {
      if (
        !innerList &&
        node instanceof HTMLElement &&
        (node.tagName === "UL" || node.tagName === "OL")
      ) {
        innerList = node.tagName;
      }
      if (!inline) {
        const name = node.nodeName;
        if (name === "STRONG") inline = "bold";
        else if (name === "EM") inline = "italic";
        else if (name === "CODE") inline = "code";
        // execCommand writes <s>/<u>, pasted or re-rendered content
        // carries <del>/<ins> - both map to the same semantic format.
        else if (name === "DEL" || name === "S" || name === "STRIKE")
          inline = "strike";
        else if (name === "INS" || name === "U") inline = "underline";
      }
      node = node.parentNode;
    }
    // A code block renders as a figure around its pre (the code
    // header is its inspector); it reflects as a code block.
    const tag =
      node instanceof HTMLElement
        ? node.classList.contains("folio-codeblock")
          ? "PRE"
          : node.tagName
        : "";
    blockButtons.forEach((b) => {
      const want =
        b.dataset.block === "p" ? "P" : (b.dataset.block ?? "").toUpperCase();
      const current =
        (want === "UL" || want === "OL") && innerList ? innerList : tag;
      b.classList.toggle("active", current === want);
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
  if (line.startsWith("### ")) block = "h3";
  else if (line.startsWith("## ")) block = "h2";
  else if (line.startsWith("# ")) block = "h1";
  else if (/^[-*+] /.test(line)) block = "ul";
  else if (/^\d+[.)] /.test(line)) block = "ol";
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

function applyMdLinePrefix(prefixIn: string): void {
  let prefix = prefixIn;
  const v = editor.value;
  const caret = editor.selectionStart;
  const [start, end] = mdLineBounds(caret);
  const current = v.slice(start, end);
  // A second press of the same list button removes the marker.
  if (
    (prefix === "-" && /^[-*+] /.test(current)) ||
    (prefix === "1." && /^\d+[.)] /.test(current))
  ) {
    prefix = "";
  }
  const stripped = current.replace(/^(#{1,6}|[-*+]|\d+[.)])\s+/, "");
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

/* --- Dark / light mode (spec: docs/specs/dark-light-mode.md) ---
 * The app chrome dresses from CSS variables; every <folio-doc>
 * gets the same mode as an attribute and re-dresses its document
 * in the theme's own dark rendition. The choice persists in
 * localStorage and defaults to the system preference. */
const MODE_KEY = "folio:mode";
const btnMode = requireEl<HTMLButtonElement>("#btn-mode");

function currentMode(): "dark" | "light" {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

function reflectMode(): void {
  const dark = currentMode() === "dark";
  btnMode.title = dark ? "Switch to light mode" : "Switch to dark mode";
  btnMode.setAttribute("aria-label", btnMode.title);
  for (const doc of Array.from(document.querySelectorAll("folio-doc"))) {
    doc.setAttribute("mode", currentMode());
  }
}

function setMode(mode: "dark" | "light"): void {
  document.documentElement.dataset.mode = mode;
  localStorage.setItem(MODE_KEY, mode);
  reflectMode();
}

(function initMode(): void {
  // The <head> script set the attribute before first paint
  // (saved choice, else the system preference); the documents and
  // the button follow it.
  reflectMode();
})();

function toggleMode(): void {
  setMode(currentMode() === "dark" ? "light" : "dark");
}

btnMode.addEventListener("click", toggleMode);

/* --- Undo/redo (spec: docs/specs/undo-redo.md) --- */

const btnUndo = requireEl<HTMLButtonElement>("#btn-undo");
const btnRedo = requireEl<HTMLButtonElement>("#btn-redo");

function reflectHistory(): void {
  btnUndo.disabled = !el.canUndo();
  btnRedo.disabled = !el.canRedo();
}

el.addEventListener("folio-history", reflectHistory);
btnUndo.addEventListener("click", () => el.undo());
btnRedo.addEventListener("click", () => el.redo());

// App-wide undo: the component owns Ctrl+Z inside its shadow root,
// and text fields keep their native undo - this listener catches
// the rest (focus on a toolbar button, on the page body) so undo
// works wherever the caret is NOT.
document.addEventListener("keydown", (ev) => {
  if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
  const key = ev.key.toLowerCase();
  const isUndo = key === "z" && !ev.shiftKey;
  const isRedo = (key === "z" && ev.shiftKey) || key === "y";
  if (!isUndo && !isRedo) return;
  const t = ev.target instanceof HTMLElement ? ev.target : null;
  // Fields keep their native per-field undo (the Markdown source
  // textarea included); the component handles its own shadow tree.
  if (t && t.closest("input, textarea") !== null) return;
  if (t && t.closest("folio-doc") !== null) return;
  ev.preventDefault();
  if (isUndo) el.undo();
  else el.redo();
});

el.onChange(() => {
  const md = el.getMarkdown();
  if (md !== null) editor.value = md;
  refreshOutline();
});

boot();

// The wordmark is the way home: the welcome page.
requireEl<HTMLButtonElement>("#btn-home").addEventListener("click", () => {
  void openShipped(WELCOME);
});

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

const fileBar = requireEl<HTMLElement>("#file-bar");
const btnOpen = requireEl<HTMLButtonElement>("#btn-open");
const btnSave = requireEl<HTMLButtonElement>("#btn-save");

/** The open document's file path, when it came from disk. The
 * Open/Save dialogs start in ITS folder - never the home folder
 * - and in-memory docs (examples, links, imports) clear it. */
let currentDocPath: string | null = null;

if (isDesktop()) {
  fileBar.hidden = false;
}

btnOpen.addEventListener("click", async () => {
  const res = await openDocument(currentDocPath ?? undefined);
  if (res === null) return;
  currentDocPath = res.path;
  await el.load(res.text);
  editor.value = res.text;
  refreshOutline();
  flash("Opened document");
});

btnSave.addEventListener("click", async () => {
  const md = el.getMarkdown();
  if (md === null) return;
  const path = await saveDocument(md, currentDocPath ?? undefined);
  if (path !== null) {
    currentDocPath = path;
    flash(`Saved ${path}`);
  }
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

/* --- Command palette (spec: docs/specs/command-palette.md) --- */

const paletteModal = requireEl<HTMLDialogElement>("#palette-modal");
const paletteInput = requireEl<HTMLInputElement>("#palette-input");
const paletteList = requireEl<HTMLElement>("#palette-list");
const helpDoc = requireEl<FolioDoc>("#help-doc");

const EXAMPLES: { id: string; file: string; blurb: string }[] = [
  {
    id: "field-operations",
    file: "/demo/examples/field-operations.md",
    blurb: "quarterly review report regional table growth chart cumulative",
  },
  {
    id: "poem",
    file: "/demo/examples/poem.md",
    blurb: "pure prose and poetry",
  },
  {
    id: "accounts",
    file: "/demo/examples/accounts.md",
    blurb: "accounts running totals budget negative growth",
  },
  {
    id: "report",
    file: "/demo/examples/report.md",
    blurb: "data report import windowed table running formulas line charts",
  },
  {
    id: "technical",
    file: "/demo/examples/technical.md",
    blurb: "technical code equations benchmarks",
  },
  {
    id: "signal-processing",
    file: "/demo/examples/signal-processing.md",
    blurb: "signal processing fft dft filter spectrum math frequency",
  },
  {
    id: "music",
    file: "/demo/examples/music.md",
    blurb: "music strudel audio beats pattern fun player",
  },
  {
    id: "drawings",
    file: "/demo/examples/drawings.md",
    blurb: "drawings graphviz dot graph diagram vega svg music notation",
  },
  {
    id: "3d-models",
    file: "/demo/examples/3d-models.md",
    blurb: "3d models jscad cad parts gear bracket parametric drawing",
  },
  {
    id: "amensister",
    file: "/demo/examples/amensister.md",
    blurb: "music strudel amen break breakbeat online samples felix roos",
  },
];

interface PaletteEntry {
  title: string;
  group: "Command" | "Help" | "Section";
  keywords: string;
  action: () => void;
}

/**
 * Everything the palette can reach: the toolbar commands, the
 * document's sections, and the help document's topics. Rebuilt on
 * every open so view state and the outline stay current.
 */
function paletteEntries(): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  // The hidden attribute lives on the wrapping md-wrap, not the
  // textarea itself.
  const inMd = !mdWrap.hidden;
  entries.push({
    title: inMd ? "Switch to Document view" : "Switch to Markdown source",
    group: "Command",
    keywords: "view switch toggle markdown source document",
    action: () => (inMd ? btnView : btnMd).click(),
  });
  entries.push({
    title: "Insert a table",
    group: "Command",
    keywords: "table insert new add simple markdown pipe grid rows columns",
    action: () => btnTable.click(),
  });
  entries.push({
    title: "Insert a Graphviz diagram (DOT)",
    group: "Command",
    keywords:
      "graphviz dot graph diagram network tree dependency flow nodes edges insert",
    action: () => {
      el.insertGraphviz();
      flash("Graphviz diagram inserted");
    },
  });
  entries.push({
    title: "Insert a 3D model (JSCAD)",
    group: "Command",
    keywords:
      "3d model jscad cad part solid shape openscad design drawing mechanical insert",
    action: () => {
      el.insertJscad();
      flash("3D model inserted");
    },
  });
  entries.push({
    title: "Insert a chart",
    group: "Command",
    keywords: "chart graph plot bar line pie visualize visualise draw insert",
    action: () => {
      const why = el.insertChart();
      flash(why ?? "Chart inserted");
    },
  });
  entries.push({
    title: "Insert a dataset",
    group: "Command",
    keywords:
      "dataset data typed table formulas units chart source advanced database spreadsheet",
    action: () => {
      el.insertDataset();
      flash("Dataset inserted");
    },
  });
  entries.push({
    title: "Insert a Mermaid diagram",
    group: "Command",
    keywords: "diagram mermaid insert graph figure",
    action: () => btnDiagram.click(),
  });
  entries.push({
    title: "Toggle a code block",
    group: "Command",
    keywords: "code block fence toggle",
    action: () => btnCodeBlock.click(),
  });
  entries.push({
    title: "Insert an equation",
    group: "Command",
    keywords: "equation math latex formula insert",
    // Without a caret the equation appends at the document end -
    // the palette must not depend on prior document focus.
    action: () => {
      el.insertMath();
      flash("Equation inserted");
    },
  });
  entries.push({
    title: "Insert a Strudel music block",
    group: "Command",
    keywords: "music strudel audio beat pattern sound player live coding",
    action: () => btnStrudel.click(),
  });
  entries.push({
    title: "Change the code block language",
    group: "Command",
    keywords:
      "code block language syntax highlighting highlight python javascript typescript rust sql shell strudel fence",
    action: () => {
      if (!el.focusCodeLanguage()) {
        flash("Click into a code block first, then change its language");
      }
    },
  });
  entries.push({
    title: "Import the demo dataset (monthly-sales.csv)",
    group: "Command",
    keywords: "demo dataset sample data import csv try test data",
    action: () => {
      void (async (): Promise<void> => {
        const res = await fetch("/demo/data/monthly-sales.csv");
        if (!res.ok) {
          flash("Demo dataset not found");
          return;
        }
        const text = await res.text();
        let table: Table;
        try {
          table = importedTable(
            tableIdFromFileName("monthly-sales.csv", el.getDoc()),
            parseImport(text, "csv"),
            "monthly-sales.csv",
          );
        } catch (e) {
          flash(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
        el.insertImportedTable(table);
        flash(
          `Imported ${table.rows.length.toLocaleString()} rows into @${table.id}`,
        );
      })();
    },
  });
  entries.push({
    title: "Import data from a file (CSV or JSON)",
    group: "Command",
    keywords: "import data csv json file table dataset load",
    // No prior document focus needed: without a caret the imported
    // table appends at the document end.
    action: () => importFile.click(),
  });
  entries.push({
    title: "Insert an image",
    group: "Command",
    keywords: "image picture photo insert figure png jpg svg",
    // The palette must not depend on prior document focus: the
    // file picker opens directly, and without a caret the image
    // appends at the document end.
    action: () => imageFile.click(),
  });
  entries.push({
    title: "Insert an audio clip",
    group: "Command",
    keywords: "audio sound music clip mp3 wav embed insert recording voice",
    // Same focus-free contract as the image picker.
    action: () => audioFile.click(),
  });
  entries.push({
    title: "Toggle dark mode",
    group: "Command",
    keywords: "dark light theme mode night appearance contrast toggle",
    action: () => toggleMode(),
  });
  entries.push({
    title: "Undo",
    group: "Command",
    keywords: "undo revert back history step z",
    action: () => {
      if (!el.undo()) flash("Nothing to undo");
    },
  });
  entries.push({
    title: "Redo",
    group: "Command",
    keywords: "redo repeat again forward history step",
    action: () => {
      if (!el.redo()) flash("Nothing to redo");
    },
  });
  entries.push({
    title: "Record an audio clip",
    group: "Command",
    keywords: "record microphone mic voice capture memo dictation audio",
    // Same handler as the toolbar button: without a caret the clip
    // appends at the document end; invoked while recording it stops.
    action: () => toggleRecording(),
  });
  entries.push({
    title: "Toggle the section browser",
    group: "Command",
    keywords: "sections sidebar outline toggle navigation",
    action: () => btnSidebar.click(),
  });
  entries.push({
    title: "Open the help document",
    group: "Command",
    keywords: "help reference guide how to",
    action: () => openHelp(),
  });
  entries.push({
    title: "Document settings",
    group: "Command",
    keywords: "settings style font theme frontmatter page break",
    action: () => openSettings(),
  });
  for (const [block, title, keywords] of [
    ["p", "Paragraph", "paragraph normal plain body text remove list unlist"],
    ["h1", "Heading 1", "heading title h1 header"],
    ["h2", "Heading 2", "heading section subheading h2 header"],
    ["h3", "Heading 3", "heading subsection h3 header"],
  ] as const) {
    entries.push({
      title,
      group: "Command",
      keywords,
      action: () => clickBlockButton(block),
    });
  }
  entries.push({
    title: "Bulleted list",
    group: "Command",
    keywords: "bullet list bullets bulleted points unordered list ul dash -",
    action: () => clickBlockButton("ul"),
  });
  entries.push({
    title: "Indent list item (Tab)",
    group: "Command",
    keywords:
      "indent nest sub list item bullet deeper tab sublist demote increase indent level",
    action: () => {
      if (!el.indentListItem()) {
        flash("Put the caret in a list item below another item");
      }
    },
  });
  entries.push({
    title: "Outdent list item (Shift+Tab)",
    group: "Command",
    keywords:
      "outdent unindent lift list item bullet shallower shift tab promote decrease indent level",
    action: () => {
      if (!el.outdentListItem()) flash("Put the caret in a nested list item");
    },
  });
  entries.push({
    title: "Numbered list",
    group: "Command",
    keywords: "numbered list ordered list numbers steps ol 1.",
    action: () => clickBlockButton("ol"),
  });
  entries.push({
    title: "Change theme",
    group: "Command",
    keywords:
      "theme look style design appearance fonts colours colors palette template",
    action: () => openSettings({ focusTheme: true }),
  });
  entries.push({
    title: "Print the document",
    group: "Command",
    keywords: "print pdf export paper",
    action: () => window.print(),
  });
  for (const ex of EXAMPLES) {
    entries.push({
      title: `Open example: ${ex.id}`,
      group: "Command",
      keywords: `example demo document open load ${ex.id} ${ex.blurb}`,
      action: () => {
        void openShipped(ex.file).then(() => flash(`Opened ${ex.id}`));
      },
    });
  }
  entries.push({
    title: "Open the welcome page",
    group: "Command",
    keywords: "welcome home start front page about intro overview examples",
    action: () => void openShipped(WELCOME),
  });
  if (!fileBar.hidden) {
    entries.push({
      title: "Open a document",
      group: "Command",
      keywords: "open load file document",
      action: () => btnOpen.click(),
    });
    entries.push({
      title: "Save the document",
      group: "Command",
      keywords: "save write file document",
      action: () => btnSave.click(),
    });
  }
  for (const section of el.getOutline()) {
    entries.push({
      title: section.text,
      group: "Section",
      keywords: "section jump go to heading outline",
      action: () => el.revealBlock(section.blockIndex),
    });
  }
  for (const topic of helpDoc.getOutline()) {
    entries.push({
      title: `Help: ${topic.text}`,
      group: "Help",
      keywords: "help how to documentation guide",
      action: () => {
        openHelp();
        helpDoc.revealBlock(topic.blockIndex);
      },
    });
  }
  return entries;
}

/**
 * Subsequence fuzzy match with bonuses for adjacent characters and
 * word starts. -1 means no match.
 */
function fuzzyScore(needle: string, haystack: string): number {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (!n) return 1;
  // The query appearing VERBATIM beats any scattered-letter
  // match: "poem" must rank the poem example over a command whose
  // keywords merely contain p...o...e...m somewhere.
  let score = h.includes(n) ? 10 : 0;
  let hi = 0;
  let last = -2;
  for (const ch of n) {
    const at = h.indexOf(ch, hi);
    if (at < 0) return -1;
    score += at === last + 1 ? 3 : 1;
    if (at === 0 || " .:-".includes(h[at - 1] ?? "")) score += 2;
    last = at;
    hi = at + 1;
  }
  return score;
}

let paletteFiltered: PaletteEntry[] = [];
let paletteSel = 0;

function renderPalette(): void {
  paletteList.textContent = "";
  if (paletteFiltered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = "No matches";
    paletteList.appendChild(empty);
    return;
  }
  paletteFiltered.forEach((entry, i) => {
    const btn = document.createElement("button");
    btn.className = `palette-item${i === paletteSel ? " selected" : ""}`;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", i === paletteSel ? "true" : "false");
    const tag = document.createElement("span");
    tag.className = "palette-tag";
    tag.textContent = entry.group;
    btn.appendChild(tag);
    btn.appendChild(document.createTextNode(entry.title));
    btn.addEventListener("click", () => runPalette(i));
    paletteList.appendChild(btn);
  });
  (paletteList.children[paletteSel] as HTMLElement | undefined)?.scrollIntoView(
    { block: "nearest" },
  );
}

function runPalette(i: number): void {
  const entry = paletteFiltered[i];
  if (!entry) return;
  paletteModal.close();
  // Closing hands focus back to the document, which drops the caret
  // at its start; put it back where it was so the command acts THERE
  // (and the next one does too).
  el.restoreCaret();
  entry.action();
}

function updatePalette(): void {
  const query = paletteInput.value.trim();
  const all = paletteEntries();
  if (!query) {
    // Every command, then a taste of each other group - a growing
    // command list must never push sections and help out of sight.
    const commands = all.filter((e) => e.group === "Command");
    const sections = all.filter((e) => e.group === "Section").slice(0, 10);
    const help = all.filter((e) => e.group === "Help").slice(0, 10);
    paletteFiltered = [...commands, ...sections, ...help];
  } else {
    paletteFiltered = all
      .map((e) => ({
        e,
        s: fuzzyScore(query, `${e.title} ${e.keywords}`),
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e)
      .slice(0, 30);
  }
  paletteSel = 0;
  renderPalette();
}

function openPalette(): void {
  if (paletteModal.open) return;
  el.saveCaret();
  paletteModal.showModal();
  paletteInput.value = "";
  updatePalette();
  paletteInput.focus();
}

requireEl<HTMLButtonElement>("#btn-search").addEventListener(
  "click",
  openPalette,
);

document.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
    ev.preventDefault();
    openPalette();
  }
});

paletteInput.addEventListener("input", updatePalette);

paletteInput.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    ev.preventDefault();
    paletteSel =
      ev.key === "ArrowDown"
        ? Math.min(paletteSel + 1, paletteFiltered.length - 1)
        : Math.max(paletteSel - 1, 0);
    renderPalette();
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    runPalette(paletteSel);
  }
});

/* --- Document settings (spec: docs/specs/document-settings.md) --- */

const settingsModal = requireEl<HTMLDialogElement>("#settings-modal");
const settingsForm = requireEl<HTMLFormElement>("#settings-form");
const setBodyFont = requireEl<HTMLSelectElement>("#set-body-font");
const setH1Font = requireEl<HTMLSelectElement>("#set-h1-font");
const setBodySize = requireEl<HTMLInputElement>("#set-body-size");
const setH1Size = requireEl<HTMLInputElement>("#set-h1-size");
const setH2Size = requireEl<HTMLInputElement>("#set-h2-size");
const setH3Size = requireEl<HTMLInputElement>("#set-h3-size");
const themeGrid = requireEl<HTMLElement>("#set-theme");
const setTableStyle = requireEl<HTMLSelectElement>("#set-table-style");
const setPalette = requireEl<HTMLSelectElement>("#set-palette");
const setPbH1 = requireEl<HTMLSelectElement>("#set-pb-h1");
const setPbH2 = requireEl<HTMLSelectElement>("#set-pb-h2");
const overrideNote = requireEl<HTMLElement>("#settings-override-note");
const btnSettingsReset = requireEl<HTMLButtonElement>("#btn-settings-reset");

/** The family name at the head of a CSS font stack. */
function familyOf(stack: string): string {
  return /^"([^"]+)"/.exec(stack)?.[1] ?? stack.split(",")[0] ?? stack;
}

/**
 * The shipped themes as cards (spec: docs/specs/themes.md): each is
 * a tiny page in the theme's own paper, heading face, and palette,
 * for the CURRENT mode - you pick a theme by looking at it. The
 * dialog writes the `theme:` frontmatter line; the override fields
 * below still win, key by key.
 */
function buildThemeCards(selected: string): void {
  const mode = currentMode();
  themeGrid.textContent = "";
  for (const name of themeNames()) {
    const look = presetTheme(name);
    const info = themeInfo(name);
    const c = look.colors[mode];
    const card = document.createElement("label");
    card.className = "theme-card";
    card.dataset.theme = name;
    card.title = `${info.label} - ${info.description}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "theme";
    input.value = name;
    input.checked = name === selected;
    input.setAttribute("aria-label", info.label);
    input.addEventListener("change", reflectThemeDefaults);
    const sample = document.createElement("span");
    sample.className = "tc-sample";
    sample.style.background = c.paper;
    sample.style.color = c.heading;
    sample.style.fontFamily = look.h1Font;
    sample.style.fontWeight = String(look.headingWeight);
    sample.textContent = "Aa";
    const swatches = document.createElement("span");
    swatches.className = "tc-swatches";
    for (const color of look.palette[mode].slice(0, 5)) {
      const sw = document.createElement("i");
      sw.style.background = color;
      swatches.appendChild(sw);
    }
    sample.appendChild(swatches);
    const label = document.createElement("span");
    label.className = "tc-name";
    label.textContent = info.label;
    const desc = document.createElement("span");
    desc.className = "tc-desc";
    desc.textContent = info.description;
    card.append(input, sample, label, desc);
    themeGrid.appendChild(card);
  }
}

function selectedTheme(): string {
  return (
    themeGrid.querySelector<HTMLInputElement>("input:checked")?.value ??
    "default"
  );
}

function fillOptions(
  sel: HTMLSelectElement,
  values: readonly string[],
  current: string | undefined,
): void {
  sel.textContent = "";
  const def = document.createElement("option");
  def.value = "default";
  sel.appendChild(def);
  const options = [...values];
  if (current && !options.includes(current)) options.push(current);
  for (const name of options) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  }
  sel.value = current ?? "default";
}

/**
 * The "default" entries and placeholders name what the SELECTED
 * theme gives, so leaving a field alone visibly means "the theme's".
 */
function reflectThemeDefaults(): void {
  const look = presetTheme(selectedTheme());
  const named = (sel: HTMLSelectElement, value: string): void => {
    const def = sel.querySelector<HTMLOptionElement>('option[value="default"]');
    if (def) def.textContent = `Theme default (${value})`;
  };
  named(setBodyFont, familyOf(look.bodyFont));
  named(setH1Font, familyOf(look.h1Font));
  named(setTableStyle, look.tableStyle);
  const paletteName =
    Object.entries(PALETTES).find(([, p]) => p === look.palette)?.[0] ??
    "muted";
  named(setPalette, paletteName);
  setBodySize.placeholder = look.bodySize;
  setH1Size.placeholder = look.h1Size;
  setH2Size.placeholder = look.h2Size;
  setH3Size.placeholder = look.h3Size;
  reflectOverrides();
}

const overrideFields = (): (HTMLSelectElement | HTMLInputElement)[] => [
  setBodyFont,
  setH1Font,
  setBodySize,
  setH1Size,
  setH2Size,
  setH3Size,
  setTableStyle,
  setPalette,
];

/** Say how many fields override the theme - they would mask it. */
function reflectOverrides(): void {
  let n = 0;
  for (const f of overrideFields()) {
    const on = f.value !== "" && f.value !== "default";
    f.classList.toggle("overridden", on);
    f.title = on ? "Overrides the theme - Reset to theme clears it" : "";
    if (on) n++;
  }
  overrideNote.textContent =
    n === 0
      ? "none - the theme decides"
      : `${String(n)} setting${n === 1 ? "" : "s"} override the theme`;
  btnSettingsReset.disabled = n === 0;
}

for (const f of overrideFields()) {
  f.addEventListener("change", reflectOverrides);
  f.addEventListener("input", reflectOverrides);
}

btnSettingsReset.addEventListener("click", () => {
  for (const f of overrideFields())
    f.value = f instanceof HTMLSelectElement ? "default" : "";
  reflectOverrides();
});

function fillSettings(): void {
  const doc = el.getDoc();
  const style = new Map(doc?.frontmatter.style ?? []);
  buildThemeCards(doc?.frontmatter.theme ?? "default");
  fillOptions(setBodyFont, BUNDLED_FONTS, style.get("body.font.family"));
  fillOptions(setH1Font, BUNDLED_FONTS, style.get("h1.font.family"));
  setBodySize.value = style.get("body.font.size") ?? "";
  setH1Size.value = style.get("h1.font.size") ?? "";
  setH2Size.value = style.get("h2.font.size") ?? "";
  setH3Size.value = style.get("h3.font.size") ?? "";
  fillOptions(setTableStyle, TABLE_STYLES, style.get("table.style"));
  fillOptions(setPalette, Object.keys(PALETTES), style.get("chart.palette"));
  setPbH1.value = style.get("pagebreak.h1") === "before" ? "before" : "default";
  setPbH2.value = style.get("pagebreak.h2") === "before" ? "before" : "default";
  reflectThemeDefaults();
}

function openSettings(opts?: { focusTheme?: boolean }): void {
  fillSettings();
  if (!settingsModal.open) settingsModal.showModal();
  if (opts?.focusTheme) {
    themeGrid.querySelector<HTMLInputElement>("input:checked")?.focus();
  }
}

requireEl<HTMLButtonElement>("#btn-settings").addEventListener("click", () =>
  openSettings(),
);
requireEl<HTMLButtonElement>("#btn-settings-cancel").addEventListener(
  "click",
  () => settingsModal.close(),
);

settingsForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const md = mdWrap.hidden ? (el.getMarkdown() ?? "") : editor.value;
  try {
    const doc = parseDoc(md);
    // The frontmatter is the source of truth: the dialog only
    // writes style keys through the same parse/serialize pipeline
    // as editing the YAML by hand. "default" and empty fields
    // remove the key so the theme default applies. Existing key
    // order is preserved - the dialog must not churn the user's
    // YAML - and keys it does not know about pass through
    // untouched.
    const values: Record<string, string> = {
      "body.font.family": setBodyFont.value,
      "h1.font.family": setH1Font.value,
      "body.font.size": setBodySize.value.trim(),
      "h1.font.size": setH1Size.value.trim(),
      "h2.font.size": setH2Size.value.trim(),
      "h3.font.size": setH3Size.value.trim(),
      "table.style": setTableStyle.value,
      "chart.palette": setPalette.value,
      "pagebreak.h1": setPbH1.value,
      "pagebreak.h2": setPbH2.value,
    };
    // The theme name rides the `theme:` frontmatter line;
    // "default" removes it so the fallback look applies.
    const theme = selectedTheme();
    if (theme !== "default") {
      doc.frontmatter.theme = theme;
    } else {
      delete doc.frontmatter.theme;
    }
    const style: [string, string][] = [];
    const seen = new Set<string>();
    for (const [key, value] of doc.frontmatter.style) {
      const next = values[key];
      if (next === undefined) {
        style.push([key, value]);
        continue;
      }
      if (next !== "" && next !== "default") {
        style.push([key, next]);
        seen.add(key);
      }
    }
    for (const [key, value] of Object.entries(values)) {
      if (!seen.has(key) && value !== "" && value !== "default") {
        style.push([key, value]);
      }
    }
    doc.frontmatter.style = style;
    const out = serializeDoc(doc);
    // Settings are a model change: undoable as a single step.
    el.load(out, { keepHistory: true });
    editor.value = out;
    if (!mdWrap.hidden) renderHighlight();
    settingsModal.close();
    flash("Settings applied");
    refreshOutline();
  } catch (e) {
    flash(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
  }
});

/* --- Printing / PDF (spec: docs/specs/print.md) --- */

/**
 * Whatever triggers the print (the palette command or the
 * browser's own Ctrl+P / menu), the printout shows the rendered
 * document - not the source editor or an open dialog. The page
 * break style keys apply here (paged media).
 */
window.addEventListener("beforeprint", () => {
  if (helpModal.open) helpModal.close();
  if (paletteModal.open) paletteModal.close();
  if (settingsModal.open) settingsModal.close();
  if (!mdWrap.hidden) btnView.click();
});

refreshOutline();
