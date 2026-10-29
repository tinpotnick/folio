/**
 * Demo host app (ADR-0006: our apps are hosts of the component).
 * Document view / Markdown view toggle; edits in either mode keep
 * the document as the source of truth.
 */
import { CITATION_STYLES } from "./engine/citations.js";
import {
  furnitureCss,
  furnitureFont,
  furnitureFor,
} from "./render/page-furniture";
import "./component.js";
import type { FolioDoc } from "./component.js";
import { parseDoc, serializeDoc } from "./engine/doc.js";
import {
  importedTable,
  parseImport,
  sanitizeNames,
  type ParsedImport,
} from "./engine/ingest.js";
import {
  parseFetched,
  publisherFor,
  sourceBibtex,
  sourceKey,
  type SourceMeta,
} from "./engine/sources.js";
import {
  PUBLISHERS,
  publisher,
  type KnownSeries,
  type Publisher,
} from "./engine/catalog.js";
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
  exportPdfFile,
  fetchUrlDesktop,
  launchDocument,
  onFileOpened,
  openDocument,
  openExternal,
  saveDocument,
  saveTextFile,
} from "./desktop.js";
import { clearDraft, keepDraft, readDraft, type Draft } from "./drafts.js";
import {
  hasRealFiles,
  openWebFile,
  saveWebFile,
  type WebFile,
} from "./web-files.js";

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
const btnSidebar = requireEl<HTMLButtonElement>("#btn-sidebar");
const outlineBox = requireEl<HTMLElement>("#outline");
const mdWrap = requireEl<HTMLElement>("#md-wrap");
const mdGutter = requireEl<HTMLElement>("#md-gutter");
const mdView = requireEl<HTMLElement>("#md-view");

/** The front page: what folio is, what it does, the examples. */
// Shipped documents are addressed RELATIVE to the app's page (no
// leading slash): the same build serves from "/", from a subfolder
// (GitHub Pages: /folio/), and inside the desktop app.
const WELCOME = "demo/welcome.md";

/** A new document: an empty title, the caret in it. */
const BLANK = "# \n";

/** Where people can support folio's development. */
const SUPPORT_URL = "https://buymeacoffee.com/tinpotnick";

/** Set once the first-run guide has been shown (per browser/app). */
const GUIDED_KEY = "folio.guided";

/**
 * The shipped document the address names (`?doc=`), or null for the
 * bare address - a blank document. Only same-origin `.md` paths;
 * anything else is ignored.
 */
function bootPath(): string | null {
  const doc = new URLSearchParams(window.location.search).get("doc");
  if (doc && /^\/?[\w./-]+\.md$/.test(doc) && !doc.includes("..")) {
    return doc.replace(/^\/+/, "");
  }
  return null;
}

/**
 * Boot (spec: docs/specs/welcome-page.md): a `?doc=` link opens that
 * document; the very first launch opens the getting-started guide;
 * every launch after that opens a blank document.
 */
async function boot(): Promise<void> {
  // Launched to open a file (desktop: "Open with folio", a
  // double-clicked .md): that file, before anything else.
  const launched = await launchDocument();
  if (launched) {
    await openShipped(null, { history: "replace", unguarded: true });
    await showOpened(launched.path, launched.text);
    return;
  }
  let path = bootPath();
  if (path === null) {
    let guided = true;
    try {
      guided = localStorage.getItem(GUIDED_KEY) !== null;
      localStorage.setItem(GUIDED_KEY, "1");
    } catch {
      // No storage (private window): a blank page, never a loop of guides.
    }
    if (!guided) path = WELCOME;
  }
  // Unsaved work from last time comes back on a plain launch
  // (docs/specs/web-files.md); a ?doc= link opens what it names and
  // leaves the draft for later.
  const draft = path === null ? await readDraft() : null;
  await openShipped(path, { history: "replace", unguarded: true });
  if (draft) restoreDraft(draft);
}

/** Bring back a kept draft - still unsaved, so still kept. */
function restoreDraft(draft: Draft): void {
  void el.load(draft.markdown).then(() => {
    editor.value = draft.markdown;
    refreshOutline();
    reflectTitle();
    if (draft.name) webFile = { name: draft.name, handle: null };
    const when = new Date(draft.at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    flash(`Restored your unsaved work from ${when}`);
  });
}

/** The address bar: a shipped document's `?doc=`, else the bare URL. */
function docUrl(path: string | null): string {
  return path === null ? window.location.pathname : `?doc=${path}`;
}

/**
 * Load a shipped document by path into the editor (in place), or a
 * new blank document for `null`. It opens at its TOP, and it becomes
 * a browser history entry: Back returns to the previous document
 * instead of leaving folio.
 */
async function openShipped(
  path: string | null,
  opts: {
    history?: "push" | "replace" | "none";
    scroll?: number;
    /** Skip the unsaved-changes check (boot: nothing to lose). */
    unguarded?: boolean;
  } = {},
): Promise<boolean> {
  if (
    !opts.unguarded &&
    !(await confirmLeave(path === null ? "Starting a new document" : undefined))
  )
    return false;
  let text = BLANK;
  if (path !== null) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    text = await res.text();
  }
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
  webFile = null;
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
  shownUrl = window.location.href;
  onGuide = path === WELCOME;
  markClean();
  reflectTitle();
  // A new document is for writing: the caret waits in its title.
  if (path === null) el.focusStart();
  return true;
}

/** The address of the document on screen (Back may be cancelled). */
let shownUrl = window.location.href;

window.addEventListener("popstate", (ev) => {
  const scroll = (ev.state as { scroll?: number } | null)?.scroll ?? 0;
  void openShipped(bootPath(), { history: "none", scroll }).then((went) => {
    // Cancelled: the browser already moved the address - put it back.
    if (!went) history.pushState(null, "", shownUrl);
  });
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
  // The Markdown view shows first: hiding the document may commit an
  // open editor (an equation's), and that change must land here.
  editor.hidden = false;
  mdWrap.hidden = false;
  const md = el.getMarkdown();
  if (md !== null) editor.value = md;
  el.hidden = true;
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
 * Outside folio: a new browser tab on the web; the user's own browser
 * (or mail app) on the desktop, where the app's window must never
 * navigate away from the document (ADR-0024).
 */
function openOutside(href: string): void {
  if (isDesktop()) {
    void openExternal(href).then((ok) => {
      if (!ok) flash(`Could not open ${href}`);
    });
    return;
  }
  window.open(href, "_blank", "noopener");
}

/**
 * Follow a document link: .md paths load in place (the same path
 * the examples use); anything with a protocol opens outside folio.
 * A failed fetch is a visible message, never a broken document.
 */
async function openLinkedDocument(href: string): Promise<void> {
  if (/^([a-z][a-z0-9+.-]*:\/\/|mailto:)/i.test(href)) {
    openOutside(href);
    return;
  }
  try {
    const url = new URL(href, window.location.href);
    if (!url.pathname.endsWith(".md")) {
      openOutside(url.href);
      return;
    }
    // As an app-relative path: the page's own folder is the app's.
    const appDir = new URL(".", window.location.href).pathname;
    const path = url.pathname.startsWith(appDir)
      ? url.pathname.slice(appDir.length)
      : url.pathname;
    if (await openShipped(path)) flash("Opened linked document");
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
      el.insertAudio(reader.result, "Recording");
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
    status.textContent = `Recording ${String(Math.floor(secs / 60))}:${String(secs % 60).padStart(2, "0")} - click Stop in the toolbar to finish`;
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

// The record button lives in the Insert menu; while it records, the
// bar itself says so and offers Stop.
const btnRecStop = requireEl<HTMLButtonElement>("#btn-rec-stop");
btnRecStop.addEventListener("click", () => {
  if (recorder !== null) stopRecording();
});
new MutationObserver(() => {
  btnRecStop.hidden = !btnRecord.classList.contains("rec");
  // It takes room in the bar: make the row fit again.
  fitToolbar();
}).observe(btnRecord, { attributes: true, attributeFilter: ["class"] });

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

/* --- Import data dialog: a file, open data, a web address
       (spec: docs/specs/data-import.md, ADR-0029) --- */

const importModal = requireEl<HTMLDialogElement>("#import-modal");
const importTabs = {
  file: requireEl<HTMLButtonElement>("#import-tab-file"),
  known: requireEl<HTMLButtonElement>("#import-tab-known"),
  web: requireEl<HTMLButtonElement>("#import-tab-web"),
};
const importPanes = {
  file: requireEl<HTMLElement>("#import-pane-file"),
  known: requireEl<HTMLElement>("#import-pane-known"),
  web: requireEl<HTMLElement>("#import-pane-web"),
};
type ImportTab = keyof typeof importTabs;
const importUrl = requireEl<HTMLInputElement>("#import-url");
const importError = requireEl<HTMLElement>("#import-error");
const importBlocked = requireEl<HTMLElement>("#import-blocked");
const importPreview = requireEl<HTMLElement>("#import-preview");
const importGo = requireEl<HTMLButtonElement>("#btn-import-go");
const importId = requireEl<HTMLInputElement>("#import-id");
const importCaption = requireEl<HTMLInputElement>("#import-caption");
const importPublisher = requireEl<HTMLInputElement>("#import-publisher");
const importOrigin = requireEl<HTMLInputElement>("#import-origin");
const importOriginLabel = requireEl<HTMLElement>("#import-origin-label");
const importCite = requireEl<HTMLInputElement>("#import-cite");
const importPersonal = requireEl<HTMLInputElement>("#import-personal");
const importFetchBtn = requireEl<HTMLButtonElement>("#btn-import-fetch");
const importPub = requireEl<HTMLSelectElement>("#import-pub");
const importSeries = requireEl<HTMLFieldSetElement>("#import-series");
const importCodeRow = requireEl<HTMLElement>("#import-code-row");
const importCode = requireEl<HTMLInputElement>("#import-code");
const importFrom = requireEl<HTMLInputElement>("#import-from");
const importKnownBtn = requireEl<HTMLButtonElement>("#btn-import-known");

/** What a route read, waiting in the preview for Import. */
interface Pending {
  parsed: ParsedImport;
  meta: SourceMeta;
  /** The web address it came from ("" for a file). */
  url: string;
  /** The file's name, for a file. */
  file?: string;
  /** The dataset name to offer (a known series' own). */
  id?: string;
}
let pending: Pending | null = null;

function importTab(which: ImportTab): void {
  try {
    localStorage.setItem(IMPORT_TAB_KEY, which);
  } catch {
    // Remembering the tab is a convenience only.
  }
  for (const k of Object.keys(importTabs) as ImportTab[]) {
    importTabs[k].setAttribute("aria-selected", String(k === which));
    importPanes[k].hidden = k !== which;
  }
  importReset();
  if (which === "web") importUrl.focus();
  if (which === "known") importPub.focus();
}

/** The tab Import data opened on last (a convenience: browser storage
 * may be unavailable). */
const IMPORT_TAB_KEY = "folio:import-tab";
function lastImportTab(): ImportTab {
  try {
    const t = localStorage.getItem(IMPORT_TAB_KEY);
    return t === "known" || t === "web" ? t : "file";
  } catch {
    return "file";
  }
}

function openImport(which?: ImportTab): void {
  closeMenus();
  if (!importModal.open) {
    el.saveCaret();
    importModal.showModal();
  }
  importTab(which ?? lastImportTab());
}

function importReset(): void {
  pending = null;
  importError.hidden = true;
  importBlocked.hidden = true;
  importPreview.hidden = true;
  importGo.disabled = true;
  // Import appears with something to import.
  importGo.hidden = true;
}

function importFail(msg: string): void {
  importError.textContent = msg;
  importError.hidden = false;
}

/** Today, as the ISO date an import was retrieved. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A dataset name from what the source is called. */
function nameFor(meta: SourceMeta, url: string, file?: string): string {
  let raw = file ?? "data";
  if (meta.title && meta.title.length <= 24) raw = meta.title;
  else if (url) {
    try {
      raw = new URL(url).pathname.split("/").filter(Boolean).pop() ?? raw;
    } catch {
      // keep the file name
    }
  }
  return tableIdFromFileName(raw.toLowerCase(), el.getDoc());
}

/** The licence line: what the terms allow, before anything changes. */
function licenceText(meta: SourceMeta, isFile: boolean): string {
  const lines = [
    meta.licence
      ? `Licence: ${meta.licence} - fine to share with the source credited.`
      : isFile
        ? "Licence: yours to know - if its terms do not allow sharing, tick Personal use only."
        : "Licence unknown - check the publisher's terms before sharing a document with this data.",
    meta.notice ? `${meta.notice}.` : "",
  ];
  return lines.filter(Boolean).join(" ");
}

/** Show what a route read: a sample, names, caption, the licence. */
function importShowParsed(p: Pending, caption?: string): void {
  importReset();
  if (!p.parsed.rows.length) {
    importFail("That returned no rows of data");
    return;
  }
  pending = p;
  const { parsed, meta, url, file } = p;
  requireEl<HTMLElement>("#import-summary").textContent =
    `${parsed.rows.length.toLocaleString()} rows · ${parsed.columns
      .map((c) => `${c.name} (${c.type})`)
      .join(", ")}`;
  const table = requireEl<HTMLTableElement>("#import-sample");
  table.textContent = "";
  const head = table.createTHead().insertRow();
  // Column names are editable here: a series code (IUMBV34) is a
  // poor name for formulas, charts and readers.
  for (const c of parsed.columns) {
    const th = document.createElement("th");
    const name = document.createElement("input");
    name.type = "text";
    name.className = "import-colname";
    name.value = c.name;
    name.spellcheck = false;
    name.setAttribute("aria-label", `Name of the ${c.name} column`);
    name.size = Math.max(6, Math.min(c.name.length + 1, 18));
    th.appendChild(name);
    const small = document.createElement("small");
    small.textContent = c.type;
    th.appendChild(small);
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const row of parsed.rows.slice(0, 5)) {
    const tr = body.insertRow();
    for (const v of row) tr.insertCell().textContent = String(v);
  }
  importId.value = p.id
    ? tableIdFromFileName(p.id, el.getDoc())
    : nameFor(meta, url, file);
  // A bare series code is not a caption: ask for a name instead.
  const codeOnly = !caption && /^[A-Z0-9_.,-]+$/.test(meta.title ?? "");
  importCaption.value = caption ?? (codeOnly ? "" : (meta.title ?? ""));
  importCaption.placeholder = codeOnly
    ? `What is ${meta.title ?? "it"}? e.g. "Official Bank Rate, monthly"`
    : "";
  importPublisher.value = meta.publisher ?? "";
  // A file may say where it was downloaded from - then it is cited.
  importOrigin.hidden = !file;
  importOriginLabel.hidden = !file;
  importOrigin.value = "";
  importPersonal.checked = false;
  reflectCite();
  requireEl<HTMLElement>("#import-licence").textContent = licenceText(
    meta,
    Boolean(file),
  );
  importPreview.hidden = false;
  importGo.disabled = false;
  importGo.hidden = false;
  if (codeOnly) importCaption.focus();
}

/** Citing needs a web address to cite. */
function reflectCite(): void {
  const address = pending?.file ? importOrigin.value.trim() : pending?.url;
  importCite.disabled = !address;
  importCite.checked = Boolean(address);
  importCite.parentElement?.setAttribute(
    "title",
    address ? "" : "Add the web address it came from to cite it",
  );
}

function importShow(text: string, url: string): void {
  try {
    importShowParsed({ ...parseFetched(text, url), url });
  } catch (e) {
    importReset();
    importFail(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Fetch an address: the desktop app directly; a browser page where
 * the site allows it (CORS), else the download-and-choose route.
 * Calls `got` with the text.
 */
async function importFetchText(
  url: string,
  button: HTMLButtonElement,
  got: (text: string) => void,
): Promise<void> {
  importReset();
  button.disabled = true;
  const label = button.textContent;
  button.textContent = "Fetching…";
  try {
    if (isDesktop()) {
      const res = await fetchUrlDesktop(url);
      if (res) got(res.text);
      return;
    }
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      // A browser may only read another site's data when that site
      // allows it (CORS) - most open-data publishers do not.
      requireEl<HTMLElement>("#import-blocked-text").textContent =
        "This site does not let a web page fetch its data directly. Open the address to download the file, then choose it here - folio still records this address as the source. (The desktop app fetches it directly.)";
      requireEl<HTMLAnchorElement>("#import-open-link").href = url;
      importBlocked.hidden = false;
      blockedThen = got;
      return;
    }
    if (!res.ok) {
      importFail(`The site answered ${String(res.status)} ${res.statusText}`);
      return;
    }
    got(await res.text());
  } catch (e) {
    importFail(e instanceof Error ? e.message : String(e));
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}
/** What a downloaded file is read as, after a blocked fetch. */
let blockedThen: ((text: string) => void) | null = null;

async function importFetch(): Promise<void> {
  const url = importUrl.value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    importReset();
    importFail("Enter a web address starting with https://");
    return;
  }
  await importFetchText(url, importFetchBtn, (text) => importShow(text, url));
}

/* Open data: a publisher, its series, from a year. */

function fillPublishers(): void {
  importPub.textContent = "";
  for (const p of PUBLISHERS) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    importPub.appendChild(o);
  }
  fillSeries();
}

function fillSeries(): void {
  const pub = publisher(importPub.value) ?? PUBLISHERS[0];
  if (!pub) return;
  requireEl<HTMLElement>("#import-pub-about").textContent = [
    `${pub.about}.`,
    pub.licence ? `Licence: ${pub.licence}.` : "",
    pub.notice ? `${pub.notice}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  importSeries.querySelectorAll("label").forEach((l) => l.remove());
  importSeries.hidden = pub.series.length === 0;
  pub.series.forEach((ser, i) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = pub.multi ? "checkbox" : "radio";
    input.name = "import-series";
    input.value = ser.code;
    input.checked = i === 0;
    label.append(input, ` ${ser.title}`);
    const unit = document.createElement("small");
    unit.textContent = `(${ser.unit})`;
    label.appendChild(unit);
    importSeries.appendChild(label);
  });
  importCodeRow.hidden = !pub.anyCode;
  if (pub.anyCode) {
    requireEl<HTMLElement>("#import-code-label").textContent =
      pub.anyCode.label;
    importCode.placeholder = `e.g. ${pub.anyCode.example}`;
    importCode.value = "";
  }
  importReset();
}

async function importKnown(): Promise<void> {
  const pub = publisher(importPub.value);
  if (!pub) return;
  const picked = Array.from(
    importSeries.querySelectorAll<HTMLInputElement>("input:checked"),
  ).map((i) => i.value);
  const typed = importCode.value
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const codes = [...picked, ...typed];
  if (!codes.length) {
    importReset();
    importFail(
      pub.anyCode
        ? `Type a ${pub.anyCode.label.toLowerCase()}`
        : "Choose a series",
    );
    return;
  }
  const from = Math.min(Math.max(Number(importFrom.value) || 2000, 1900), 2100);
  const url = pub.url(pub.multi ? codes : [codes[0] ?? ""], from);
  await importFetchText(url, importKnownBtn, (text) => {
    let read: ReturnType<typeof parseFetched>;
    try {
      read = parseFetched(text, url);
    } catch (e) {
      importReset();
      importFail(e instanceof Error ? e.message : String(e));
      return;
    }
    const shaped = knownShape(
      read,
      pub,
      pub.multi ? codes : [codes[0] ?? ""],
      from,
    );
    importShowParsed({ ...shaped, url }, shaped.caption);
  });
}

/**
 * Name a known series the way the catalogue does: `date`, and the
 * series' own column names (bank_rate, fixed_2y); the publisher's
 * licence; a caption from the series titles; rows from the year.
 */
function knownShape(
  read: ReturnType<typeof parseFetched>,
  pub: Publisher,
  codes: string[],
  from: number,
): { parsed: ParsedImport; meta: SourceMeta; caption: string; id: string } {
  const titles =
    (read.meta as { titles?: Record<string, string> }).titles ?? {};
  const known = (code: string): KnownSeries | undefined =>
    pub.series.find((s) => s.code === code);
  // A catalogue series' unit rides its column: the header reads
  // "bank_rate (%)".
  const withUnit = (
    c: ParsedImport["columns"][number],
    name: string,
    k: KnownSeries | undefined,
  ): ParsedImport["columns"][number] =>
    k && k.unit !== "index" ? { ...c, name, unit: k.unit } : { ...c, name };
  const cols = read.parsed.columns.map((c, i) => {
    if (c.type === "date" && i === 0) return { ...c, name: "date" };
    if (
      read.parsed.columns.length === 2 &&
      codes.length === 1 &&
      pub.id !== "hmlr"
    ) {
      const code = codes[0] ?? "";
      return withUnit(
        c,
        known(code)?.column ?? code.toLowerCase(),
        known(code),
      );
    }
    const k = known(c.name);
    return withUnit(c, k?.column ?? c.name.toLowerCase(), k);
  });
  const dateCol = cols.findIndex((c) => c.type === "date");
  const floor = `${String(from)}-01-01`;
  const rows =
    dateCol < 0
      ? read.parsed.rows
      : read.parsed.rows.filter((r) => String(r[dateCol] ?? "") >= floor);
  const caption = codes
    .map((c) => known(c)?.title ?? titles[c] ?? c)
    .join("; ");
  return {
    parsed: { columns: cols, rows },
    meta: {
      ...read.meta,
      publisher: pub.name,
      ...(pub.licence ? { licence: pub.licence } : {}),
      ...(pub.notice ? { notice: pub.notice } : {}),
      title: caption,
    },
    caption,
    // One series: its column's name; a few: theirs joined
    // (bank_rate_fixed_2y); many: the publisher's set.
    id:
      codes.length <= 3
        ? cols
            .slice(1)
            .map((c) => c.name)
            .join("_")
        : `${pub.id}_series`,
  };
}

/* Commit, whichever route. */

function importCommit(): void {
  if (!pending) return;
  const { meta, url, file } = pending;
  const names = sanitizeNames(
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        "#import-sample .import-colname",
      ),
    ).map((i) => i.value.trim()),
  );
  const parsed: ParsedImport = {
    ...pending.parsed,
    columns: pending.parsed.columns.map((c, i) => ({
      ...c,
      name: names[i] ?? c.name,
    })),
  };
  const address = file ? importOrigin.value.trim() : url;
  const personal = importPersonal.checked;
  const retrieved = todayIso();
  const id = tableIdFromFileName(importId.value || "data", el.getDoc());
  const finalMeta: SourceMeta = {
    ...meta,
    ...(file && address ? publisherFor(address) : {}),
    ...(importCaption.value.trim()
      ? { title: importCaption.value.trim() }
      : {}),
    ...(importPublisher.value.trim()
      ? { publisher: importPublisher.value.trim() }
      : {}),
    ...(personal
      ? { licence: "personal use only, not for redistribution" }
      : {}),
  };
  const table: Table = {
    ...importedTable(id, parsed, address || (file ?? url)),
    ...(address ? { retrieved } : {}),
    ...(finalMeta.title ? { caption: finalMeta.title } : {}),
    ...(personal
      ? { licence: "personal-use" }
      : finalMeta.licence
        ? { licence: finalMeta.licence }
        : {}),
  };
  let reference: string | undefined;
  if (importCite.checked && address) {
    const key = sourceKey(finalMeta, id, el.referenceKeys());
    table.cite = key;
    reference = sourceBibtex(key, finalMeta, address, retrieved);
  }
  importModal.close();
  el.restoreCaret();
  el.insertImportedTable(table, reference);
  flash(
    `Imported ${table.rows.length.toLocaleString()} rows into @${table.id}${
      table.cite ? ` - cite it as [@${table.cite}]` : ""
    }${personal ? " (marked personal use only)" : ""}`,
  );
}

/** A picked file: read, then the same preview. */
function importFromFile(f: File): void {
  if (f.size > IMPORT_MAX_BYTES) {
    flash("File too large (over 8 MB) - the document stays one file");
    return;
  }
  const format = f.name.toLowerCase().endsWith(".json") ? "json" : "csv";
  void f.text().then((text) => {
    openImport("file");
    try {
      importShowParsed({
        parsed: parseImport(text, format),
        meta: {},
        url: "",
        file: f.name,
      });
    } catch (e) {
      importReset();
      importFail(
        `Import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });
}

importFile.addEventListener("change", () => {
  const f = importFile.files?.[0];
  importFile.value = "";
  if (f) importFromFile(f);
});

for (const k of Object.keys(importTabs) as ImportTab[]) {
  importTabs[k].addEventListener("click", () => importTab(k));
}
fillPublishers();
importPub.addEventListener("change", fillSeries);
importKnownBtn.addEventListener("click", () => void importKnown());
importFrom.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    void importKnown();
  }
});
importCode.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    void importKnown();
  }
});
importOrigin.addEventListener("input", reflectCite);
requireEl<HTMLButtonElement>("#btn-import-data").addEventListener("click", () =>
  openImport(),
);
requireEl<HTMLButtonElement>("#btn-import-choose").addEventListener(
  "click",
  () => importFile.click(),
);
requireEl<HTMLButtonElement>("#btn-import-demo").addEventListener(
  "click",
  () => {
    importModal.close();
    el.restoreCaret();
    paletteEntries()
      .find((e) => e.title.startsWith("Import the demo dataset"))
      ?.action();
  },
);
importFetchBtn.addEventListener("click", () => void importFetch());
importUrl.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    void importFetch();
  }
});
importUrl.addEventListener("input", importReset);
importGo.addEventListener("click", importCommit);
// The browser route: the user downloads the file, folio reads it as
// if fetched, keeping the address as its source.
requireEl<HTMLButtonElement>("#btn-import-downloaded").addEventListener(
  "click",
  () => {
    const then = blockedThen;
    const pick = document.createElement("input");
    pick.type = "file";
    pick.accept = ".csv,.json,text/csv,application/json";
    pick.addEventListener("change", () => {
      const f = pick.files?.[0];
      if (!f || !then) return;
      if (f.size > IMPORT_MAX_BYTES) {
        importFail("File too large (over 8 MB) - the document stays one file");
        return;
      }
      void f.text().then(then);
    });
    pick.click();
  },
);

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
  const blockButtons =
    blockBar.querySelectorAll<HTMLButtonElement>("button[data-block]");
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

// Per change (per keystroke while typing): the Markdown view, when it
// shows, follows at once; hidden, it is refilled when it is opened, so
// serializing the whole document per letter is wasted work. The
// sections list follows when typing pauses.
let outlineTimer: ReturnType<typeof setTimeout> | undefined;
el.onChange(() => {
  if (!mdWrap.hidden) {
    const md = el.getMarkdown();
    if (md !== null) editor.value = md;
  }
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(refreshOutline, 150);
});

// The wordmark is the way home: the welcome page.
requireEl<HTMLButtonElement>("#btn-home").addEventListener("click", () => {
  void openShipped(WELCOME);
});

/* --- Section browser (left sidebar) --- */

// The toolbar's real height (it can wrap on narrow windows), for
// scroll-padding: jumps land headings below it, not under it.
const headerEl = document.querySelector("header");
if (headerEl) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      "--header-h",
      `${String(headerEl.offsetHeight)}px`,
    );
  }).observe(headerEl);
}

function refreshOutline(): void {
  const outline = el.getOutline();
  outlineBox.textContent = "";
  if (outline.length === 0) {
    sidebar.hidden = true;
    btnSidebar.setAttribute("aria-pressed", "false");
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
      // The clicked entry is the answer, even when the page cannot
      // scroll its heading to the top (the last sections): hold it
      // until the jump's scrolling stops.
      holdActive(btn);
    });
    outlineBox.appendChild(btn);
  }
  reflectActiveSection();
}

let activeHeld: number | undefined;

function holdActive(btn: HTMLButtonElement): void {
  outlineBox.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  window.clearTimeout(activeHeld);
  activeHeld = window.setTimeout(() => (activeHeld = undefined), 200);
}

function reflectActiveSection(): void {
  // Document view only (the Markdown source has no rendered headings).
  // This tested the textarea, which stays un-hidden until a section
  // is clicked - so the mark never moved before that first click.
  if (!mdWrap.hidden) return;
  if (activeHeld !== undefined) {
    // Still scrolling from a jump: wait for it to settle.
    window.clearTimeout(activeHeld);
    activeHeld = window.setTimeout(() => (activeHeld = undefined), 200);
    return;
  }
  // The section being read is the one at the top of the VISIBLE page,
  // just below the sticky toolbar.
  const first = el.firstVisibleBlockIndex(
    document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
  );
  const outline = el.getOutline();
  let activeIdx = -1;
  outline.forEach((entry, i) => {
    if (entry.blockIndex <= first) activeIdx = i;
  });
  // At the very end of the page the last sections cannot reach the
  // top: the mark goes to the last heading in view.
  const atEnd =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 2;
  if (atEnd && window.scrollY > 0) {
    const shown = el.lastBlockInView();
    outline.forEach((entry, i) => {
      if (entry.blockIndex <= shown) activeIdx = i;
    });
  }
  outlineBox.querySelectorAll("button").forEach((btn, i) => {
    btn.classList.toggle("active", i === activeIdx);
  });
}

window.addEventListener("scroll", reflectActiveSection, { passive: true });
window.addEventListener("resize", reflectActiveSection, { passive: true });

btnSidebar.addEventListener("click", () => {
  sidebar.hidden = !sidebar.hidden;
  btnSidebar.setAttribute("aria-pressed", String(!sidebar.hidden));
  reflectActiveSection();
});

/* --- Desktop (Tauri) bridge: native Open/Save (ADR-0006) --- */

const btnOpen = requireEl<HTMLButtonElement>("#btn-open");
const btnSave = requireEl<HTMLButtonElement>("#btn-save");

/** The open document's file path, when it came from disk. The
 * Open/Save dialogs start in ITS folder - never the home folder
 * - and in-memory docs (examples, links, imports) clear it. */
let currentDocPath: string | null = null;

/** The web host's open file (its name, and a handle to write back to
 * where the browser allows). */
let webFile: WebFile | null = null;

/* --- Unsaved changes (spec: docs/specs/unsaved-changes.md) ---
 * The document as of its last load or save, serialized: anything that
 * would REPLACE the document asks first when the current Markdown
 * differs from it (undoing back to it counts as clean). */
let cleanMarkdown: string | null = null;

function currentMarkdown(): string | null {
  return mdWrap.hidden ? el.getMarkdown() : editor.value;
}

/** Call after a document is loaded or saved: it is now "clean". */
function markClean(): void {
  cleanMarkdown = el.getMarkdown();
}

/** The guide is a playground: trying its live table is not "work". */
let onGuide = false;

function isDirty(): boolean {
  if (onGuide) return false;
  const md = currentMarkdown();
  return cleanMarkdown !== null && md !== null && md !== cleanMarkdown;
}

const unsavedModal = requireEl<HTMLDialogElement>("#unsaved-modal");
const unsavedText = requireEl<HTMLElement>("#unsaved-text");
const btnUnsavedSave = requireEl<HTMLButtonElement>("#btn-unsaved-save");

/**
 * Before replacing (or closing) the document: true to go ahead. Clean
 * documents go ahead at once; otherwise the user chooses Save (desktop
 * - only a completed save goes ahead), Discard changes, or Cancel.
 */
async function confirmLeave(
  action = "Opening another document",
): Promise<boolean> {
  if (!isDirty()) return true;
  unsavedText.textContent = `This document has changes that are not saved. ${action} replaces it.`;
  unsavedModal.returnValue = "cancel";
  unsavedModal.showModal();
  btnUnsavedSave.focus();
  const choice = await new Promise<string>((resolve) => {
    unsavedModal.addEventListener(
      "close",
      () => resolve(unsavedModal.returnValue || "cancel"),
      { once: true },
    );
  });
  if (choice === "discard") {
    // Thrown away on purpose: no draft to bring back.
    void clearDraft();
    return true;
  }
  if (choice === "save") return saveCurrent();
  return false;
}

/** A name to offer when saving: the open file's, else the title. */
function suggestedName(ext: string): string {
  const base =
    (webFile?.name ?? currentDocPath?.split(/[\\/]/).pop())?.replace(
      /\.(md|markdown)$/i,
      "",
    ) ??
    (el
      .getOutline()
      .find((e) => e.level === 1)
      ?.text.trim() ||
      "Untitled");
  return `${base.replace(/[\\/:*?"<>|]+/g, "-")}.${ext}`;
}

/**
 * Save: the desktop's native dialog; on the web, back to the open file
 * where the browser allows real files, else a download. True when it
 * was written.
 */
async function saveCurrent(): Promise<boolean> {
  const md = currentMarkdown();
  if (md === null) return false;
  if (isDesktop()) {
    const path = await saveDocument(md, currentDocPath ?? undefined);
    if (path === null) return false;
    currentDocPath = path;
    flash(`Saved ${path}`);
  } else {
    try {
      const saved = await saveWebFile(
        md,
        suggestedName("md"),
        webFile?.handle ?? null,
      );
      if (saved === null) return false;
      webFile = saved;
      flash(saved.handle ? `Saved ${saved.name}` : `Downloaded ${saved.name}`);
    } catch (e) {
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }
  cleanMarkdown = md;
  void clearDraft();
  return true;
}

// Closing or reloading the tab: the browser's own prompt.
window.addEventListener("beforeunload", (ev) => {
  if (isDirty()) ev.preventDefault();
});

// Closing the desktop window: the same Save / Discard / Cancel.
if (isDesktop()) {
  void (async (): Promise<void> => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.onCloseRequested(async (ev) => {
      if (!isDirty()) return;
      ev.preventDefault();
      if (await confirmLeave("Closing the window")) await win.destroy();
    });
  })();
}

// Open and Save on both hosts: the desktop's native dialogs, the web's
// own files (docs/specs/web-files.md).
btnOpen.hidden = false;
btnSave.hidden = false;

/** Pick a file: the desktop dialog, or the browser's. */
async function pickDocument(): Promise<string | null> {
  if (isDesktop()) {
    const res = await openDocument(currentDocPath ?? undefined);
    if (res === null) return null;
    currentDocPath = res.path;
    return res.text;
  }
  try {
    const res = await openWebFile();
    if (res === null) return null;
    webFile = { name: res.name, handle: res.handle };
    return res.text;
  } catch (e) {
    flash(`Could not open: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Show a document read from disk as the open, clean document. */
async function showOpened(path: string | null, text: string): Promise<void> {
  if (path !== null) currentDocPath = path;
  await el.load(text);
  editor.value = text;
  refreshOutline();
  markClean();
  reflectTitle();
  flash("Opened document");
}

btnOpen.addEventListener("click", async () => {
  if (!(await confirmLeave())) return;
  const text = await pickDocument();
  if (text === null) return;
  await showOpened(null, text);
});

// macOS: a .md opened while folio runs.
void onFileOpened(() => {
  void (async () => {
    if (!(await confirmLeave())) return;
    const res = await launchDocument();
    if (res) await showOpened(res.path, res.text);
  })();
});

btnSave.addEventListener("click", () => {
  void saveCurrent();
});
// Where the browser cannot write real files, Save downloads the .md.
if (!isDesktop() && !hasRealFiles()) {
  btnSave.title = "Save - downloads the .md file (Ctrl+S)";
}

/**
 * Keep unsaved work as it changes (debounced), so closing the tab or
 * the app loses nothing. Clean documents keep nothing.
 */
let draftTimer: ReturnType<typeof setTimeout> | undefined;
function keepDraftSoon(): void {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const md = currentMarkdown();
    if (md === null || !isDirty()) return;
    void keepDraft({
      markdown: md,
      name: webFile?.name ?? currentDocPath?.split(/[\\/]/).pop() ?? null,
      at: Date.now(),
    });
  }, 600);
}
el.onChange(keepDraftSoon);
editor.addEventListener("input", keepDraftSoon);

/* --- In-app help (spec: docs/specs/in-app-help.md) --- */

// Help docks beside the document: one folio document per topic
// (demo/help/), listed by its index. The topics are fetched once for
// searching - here and in the palette.
const HELP_DIR = "demo/help/";
const btnHelp = requireEl<HTMLButtonElement>("#btn-help");
const helpPanel = requireEl<HTMLElement>("#help-panel");
const helpDoc = requireEl<FolioDoc>("#help-doc");
const helpHome = requireEl<HTMLButtonElement>("#btn-help-home");
const helpSearch = requireEl<HTMLInputElement>("#help-search");
const helpResults = requireEl<HTMLElement>("#help-results");
const helpScroll = requireEl<HTMLElement>("#help-panel .help-scroll");

interface HelpTopic {
  title: string;
  file: string;
  group: string;
  /** What the topic says, lower case, for searching. */
  text: string;
}
let helpTopics: HelpTopic[] = [];
/** The topic showing, or null for the list of topics. */
let helpShowing: string | null = null;

async function loadHelpTopics(): Promise<void> {
  try {
    const index = await (await fetch(`${HELP_DIR}index.md`)).text();
    const listed: Omit<HelpTopic, "text">[] = [];
    let group = "";
    for (const line of index.split("\n")) {
      const g = /^## (.+)/.exec(line);
      if (g) group = g[1] ?? "";
      const t = /^- \[([^\]]+)\]\(([\w-]+\.md)\)/.exec(line);
      if (t) listed.push({ title: t[1] ?? "", file: t[2] ?? "", group });
    }
    helpTopics = await Promise.all(
      listed.map(async (t) => {
        const md = await (await fetch(HELP_DIR + t.file)).text();
        return { ...t, text: md.replace(/[`*_#>[\]()]/g, " ").toLowerCase() };
      }),
    );
  } catch {
    helpTopics = [];
  }
  // A palette opened before the topics arrived lists them now.
  if (paletteModal.open) updatePalette();
}
void loadHelpTopics();

function setHelpOpen(open: boolean): void {
  helpPanel.hidden = !open;
  btnHelp.setAttribute("aria-pressed", String(open));
}

/** Show one topic (a file in demo/help/), or the list with null. */
function showHelp(file: string | null): void {
  helpShowing = file;
  helpHome.hidden = file === null;
  helpSearch.value = "";
  showHelpResults("");
  void helpDoc.load(HELP_DIR + (file ?? "index.md"));
  helpScroll.scrollTop = 0;
}

/** Open the panel - at a topic, or where it was. */
function openHelp(file?: string): void {
  setHelpOpen(true);
  if (file !== undefined) showHelp(file);
}

function closeHelp(): void {
  const inside = helpPanel.contains(document.activeElement);
  setHelpOpen(false);
  if (inside) btnHelp.focus();
}

btnHelp.addEventListener("click", () => {
  if (helpPanel.hidden) {
    openHelp();
    if (helpShowing === null) helpSearch.focus();
  } else {
    closeHelp();
  }
});
requireEl<HTMLButtonElement>("#btn-help-close").addEventListener(
  "click",
  closeHelp,
);
helpHome.addEventListener("click", () => {
  showHelp(null);
  helpSearch.focus();
});

/** The topics that answer `query`, best first. */
function helpMatches(query: string): HelpTopic[] {
  // Words, not scattered letters: a title that starts a word with
  // the query ranks first, then topics that say it.
  const q = query.toLowerCase();
  return helpTopics
    .map((t) => ({
      t,
      score:
        bodyScore(q, t.title.toLowerCase()) > 0
          ? 100 + bodyScore(q, t.title.toLowerCase())
          : bodyScore(q, t.text),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((m) => m.t);
}

function showHelpResults(query: string): void {
  const q = query.trim();
  helpResults.hidden = q === "";
  helpDoc.hidden = q !== "";
  helpResults.textContent = "";
  if (q === "") return;
  const hits = helpMatches(q);
  if (hits.length === 0) {
    const none = document.createElement("p");
    none.className = "help-none";
    none.textContent = `No help topic mentions "${q}".`;
    helpResults.appendChild(none);
    return;
  }
  hits.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "option");
    if (i === 0) b.classList.add("active");
    const title = document.createElement("span");
    title.className = "hit-title";
    title.textContent = t.title;
    const group = document.createElement("span");
    group.className = "hit-group";
    group.textContent = t.group;
    b.append(title, group);
    b.addEventListener("click", () => showHelp(t.file));
    helpResults.appendChild(b);
  });
}

helpSearch.addEventListener("input", () => {
  showHelpResults(helpSearch.value);
});
helpSearch.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    const first = helpMatches(helpSearch.value.trim())[0];
    if (first) showHelp(first.file);
  } else if (ev.key === "Escape" && helpSearch.value !== "") {
    // Esc clears the search first; a second Esc closes the panel.
    ev.stopPropagation();
    helpSearch.value = "";
    showHelpResults("");
  }
});
helpPanel.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !ev.defaultPrevented) closeHelp();
});

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
  const typing = editable(a) || editable(a?.shadowRoot?.activeElement);
  // "?" is a character: while typing it is text, not a shortcut. F1
  // types nothing, so it works everywhere - the standard help key.
  if (ev.key === "?" && typing) return;
  ev.preventDefault();
  // Both toggle, like the toolbar button.
  if (!helpPanel.hidden) {
    closeHelp();
    return;
  }
  openHelp();
  // Opened mid-typing, the caret stays where it was: F1 again closes
  // help and typing carries on.
  if (helpShowing === null && !typing) helpSearch.focus();
});

/* --- Command palette (spec: docs/specs/command-palette.md) --- */

const paletteModal = requireEl<HTMLDialogElement>("#palette-modal");
const paletteInput = requireEl<HTMLInputElement>("#palette-input");
const paletteList = requireEl<HTMLElement>("#palette-list");
// Links in the help: another topic (`charts.md`) opens in the panel;
// anything else (graphviz.org, an example) follows like the
// document's own links, the panel staying open beside it.
helpDoc.addEventListener("folio-link", (ev) => {
  const href = (ev as CustomEvent<{ href: string }>).detail?.href;
  if (!href) return;
  const topic = /^([\w-]+\.md)$/.exec(href)?.[1];
  if (topic) {
    showHelp(topic);
    return;
  }
  void openLinkedDocument(href);
});

const EXAMPLES: { id: string; title: string; file: string; blurb: string }[] = [
  {
    id: "field-operations",
    title: "Q3 Field Operations Review",
    file: "demo/examples/field-operations.md",
    blurb: "quarterly review report regional table growth chart cumulative",
  },
  {
    id: "poem",
    title: "A pure-prose poem",
    file: "demo/examples/poem.md",
    blurb: "pure prose and poetry",
  },
  {
    id: "accounts",
    title: "Management accounts",
    file: "demo/examples/accounts.md",
    blurb: "accounts running totals budget negative growth",
  },
  {
    id: "report",
    title: "An imported data report",
    file: "demo/examples/report.md",
    blurb: "data report import windowed table running formulas line charts",
  },
  {
    id: "technical",
    title: "A technical paper",
    file: "demo/examples/technical.md",
    blurb: "technical code equations benchmarks",
  },
  {
    id: "signal-processing",
    title: "Signals and spectra",
    file: "demo/examples/signal-processing.md",
    blurb: "signal processing fft dft filter spectrum math frequency",
  },
  {
    id: "music",
    title: "A music document",
    file: "demo/examples/music.md",
    blurb: "music strudel audio beats pattern fun player",
  },
  {
    id: "sales-review",
    title: "Q3 Sales Review",
    file: "demo/examples/sales-review.md",
    blurb:
      "sales quarterly review report revenue regions pipeline heatmap stacked",
  },
  {
    id: "design-review",
    title: "Bracket design review",
    file: "demo/examples/design-review.md",
    blurb:
      "engineering design review bracket variants 3d model stl requirements",
  },
  {
    id: "practice-journal",
    title: "A practice journal",
    file: "demo/examples/practice-journal.md",
    blurb: "music practice journal log sheet music exercises charts",
  },
  {
    id: "drawings",
    title: "Drawings from text",
    file: "demo/examples/drawings.md",
    blurb: "drawings graphviz dot graph diagram vega svg music notation",
  },
  {
    id: "3d-models",
    title: "Parametric parts",
    file: "demo/examples/3d-models.md",
    blurb: "3d models jscad cad parts gear bracket parametric drawing",
  },
  {
    id: "compute",
    title: "Coffee forecast",
    file: "demo/examples/compute.md",
    blurb:
      "python compute script pyodide forecast trend regression cafe sales projection least squares",
  },
  {
    id: "repay-or-invest",
    title: "Repay or invest? A mortgage question",
    file: "demo/examples/repay-or-invest.md",
    blurb:
      "mortgage repay invest interest only endowment overpay savings shares isa finance personal bank of england ons oecd open data",
  },
  {
    id: "paper",
    title: "An academic paper",
    file: "demo/examples/paper.md",
    blurb:
      "academic paper citations bibliography references bibtex footnotes cross-references research",
  },
  {
    id: "amensister",
    title: "Amensister",
    file: "demo/examples/amensister.md",
    blurb: "music strudel amen break breakbeat online samples felix roos",
  },
];

interface PaletteEntry {
  title: string;
  group: "Command" | "Help" | "Section";
  /** The badge, when it is not the group ("Reference"). */
  tag?: string;
  keywords: string;
  /** Body text matched VERBATIM only (a help topic's words). */
  body?: string;
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
    title: "Insert sheet music (ABC)",
    group: "Command",
    keywords:
      "sheet music abc notation score notes stave staff tune melody song insert",
    action: () => {
      el.insertAbc();
      flash("Sheet music inserted");
    },
  });
  entries.push({
    title: "Insert an SVG drawing",
    group: "Command",
    keywords: "svg drawing vector illustration figure shapes markup insert",
    action: () => {
      el.insertSvg();
      flash("SVG drawing inserted");
    },
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
    title: "Insert a compute block (Python)",
    group: "Command",
    keywords:
      "compute python script data dataset transform calculate regression forecast pyodide insert",
    action: () => {
      el.insertCompute();
      flash("Compute block inserted");
    },
  });
  // One entry per reference in the bibliography: "Cite: Knuth 1984 ·
  // Literate Programming" (docs/specs/citations.md).
  for (const c of el.citationChoices()) {
    entries.push({
      title: `Cite: ${c.label}${c.title ? ` · ${c.title}` : ""} (@${c.key})`,
      group: "Command",
      tag: "Reference",
      keywords: `cite citation reference source bibliography ${c.key}`,
      action: () => {
        const why = el.insertCitation(c.key, paletteLocator);
        flash(
          why ??
            `Cited ${c.label}${paletteLocator ? `, ${paletteLocator}` : ""}`,
        );
      },
    });
  }
  entries.push({
    title: "Insert a citation",
    group: "Command",
    keywords:
      "cite citation reference source paper bibliography academic author year apa ieee",
    action: openCitePicker,
  });
  entries.push({
    title: "Insert a bibliography",
    group: "Command",
    keywords:
      "bibliography references reference list works cited sources bibtex zotero google scholar academic",
    action: () => {
      const why = el.insertBibliography();
      flash(why ?? "Bibliography added - paste BibTeX entries into it");
    },
  });
  // One entry per thing a cross-reference can name: "Cross-reference:
  // Table 2 · Revenue by product line" (docs/specs/cross-references.md).
  for (const c of el.crossRefChoices()) {
    entries.push({
      title: `Cross-reference: ${c.label}${c.caption ? ` · ${c.caption}` : ""}`,
      group: "Command",
      keywords: `cross reference refer see link mention ${c.ref.replace(":", " ")}`,
      action: () => {
        const why = el.insertCrossRef(c.ref);
        flash(why ?? `Referred to ${c.label}`);
      },
    });
  }
  entries.push({
    title: "Insert a table of contents",
    group: "Command",
    keywords:
      "table of contents toc contents outline index sections headings list",
    action: () => {
      el.insertContents();
      flash("Contents added - it keeps itself up to date");
    },
  });
  entries.push({
    title: "Insert a cross-reference",
    group: "Command",
    keywords: "cross reference refer see table figure section number caption",
    action: openCrossRefPicker,
  });
  entries.push({
    title: "Insert a footnote",
    group: "Command",
    keywords: "footnote note endnote reference annotation aside citation fn",
    action: () => {
      const why = el.insertFootnote();
      flash(why ?? "Footnote added - type the note");
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
    title: "Insert a Vega-Lite chart",
    group: "Command",
    keywords:
      "vega lite vega-lite chart heatmap facet layered visualization spec json insert",
    action: () => {
      el.insertVegaLite();
      flash("Vega-Lite chart inserted");
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
        const res = await fetch("demo/data/monthly-sales.csv");
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
  for (const [title, action, words] of [
    [
      "Insert a row below",
      "row-below",
      "add row new record line below table dataset",
    ],
    [
      "Insert a column to the right",
      "column-right",
      "add column new field right table dataset",
    ],
    ["Delete the row", "delete-row", "remove row delete record table dataset"],
    [
      "Delete the column",
      "delete-column",
      "remove column delete field table dataset",
    ],
  ] as const) {
    entries.push({
      title,
      group: "Command",
      keywords: words,
      action: () => {
        const why = el.tableActionAtCaret(action);
        if (why) flash(why);
      },
    });
  }
  entries.push({
    title: "Choose how many rows a table shows",
    group: "Command",
    keywords:
      "rows shown show more fewer lines display length limit long table dataset page all",
    action: () => {
      const why = el.focusTableRows();
      if (why) flash(why);
    },
  });
  entries.push({
    title: "Read a chart's values",
    group: "Command",
    keywords:
      "chart values read hover tooltip point data exact number readout crosshair inspect figure",
    action: () => {
      const why = el.focusChartReadout();
      flash(
        why ?? "Left and right arrows move along the chart; Esc puts it away",
      );
    },
  });
  entries.push({
    title: "Import open data (Bank of England, ONS, OECD, house prices…)",
    group: "Command",
    keywords:
      "import open data public statistics bank rate mortgage rates interest rates gilt yield inflation cpi earnings share prices stock market index ftse house prices exchange rates bank of england ons oecd land registry ecb eurostat fred",
    action: () => openImport("known"),
  });
  entries.push({
    title: "Import data",
    group: "Command",
    keywords:
      "import data dataset csv json file web url download open data source fetch personal use",
    action: () => openImport(),
  });
  entries.push({
    title: "Import data from the web (a CSV or JSON address)",
    group: "Command",
    keywords:
      "import web url address download fetch open data public source bank of england ons oecd fred land registry statistics series",
    action: () => openImport("web"),
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
    title: "Open help",
    group: "Command",
    keywords: "help reference manual documentation how to topics panel",
    action: () => {
      openHelp();
      if (helpShowing === null) helpSearch.focus();
    },
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
    title: "Support folio (Buy Me a Coffee)",
    group: "Command",
    keywords:
      "support donate donation tip coffee sponsor buy me a coffee thanks fund pay",
    action: () => openOutside(SUPPORT_URL),
  });
  entries.push({
    title: "Export as PDF",
    group: "Command",
    keywords: "export pdf save as pdf download share send file document",
    action: () => void exportPdf(),
  });
  entries.push({
    title: "Print the document",
    group: "Command",
    keywords: "print pdf export paper",
    action: printDocument,
  });
  entries.push({
    title: "Page numbers and running header",
    group: "Command",
    keywords:
      "page numbers numbering pagination footer header running title print pdf export",
    action: () => {
      openSettings();
      setPageNumbers.focus();
    },
  });
  for (const ex of EXAMPLES) {
    entries.push({
      // Named as the guide lists it; the short id still finds it.
      title: `Open example: ${ex.title}`,
      group: "Command",
      keywords: `example demo document open load ${ex.id} ${ex.blurb}`,
      action: () => {
        void openShipped(ex.file).then((went) => {
          if (went) flash(`Opened ${ex.title}`);
        });
      },
    });
  }
  entries.push({
    title: "New document",
    group: "Command",
    keywords: "new blank empty untitled create start fresh document file",
    action: () => void openShipped(null),
  });
  entries.push({
    title: "Getting started guide",
    group: "Command",
    keywords:
      "guide getting started welcome home tour intro overview about front page examples learn",
    action: () => void openShipped(WELCOME),
  });
  entries.push({
    title: "Open a document",
    group: "Command",
    keywords: "open load file document upload markdown",
    action: () => btnOpen.click(),
  });
  entries.push({
    title: "Save the document",
    group: "Command",
    keywords: "save write file document download markdown md",
    action: () => btnSave.click(),
  });
  for (const section of el.getOutline()) {
    entries.push({
      title: section.text,
      group: "Section",
      keywords: "section jump go to heading outline",
      action: () => el.revealBlock(section.blockIndex),
    });
  }
  for (const topic of helpTopics) {
    entries.push({
      title: `Help: ${topic.title}`,
      group: "Help",
      keywords: "help how to documentation guide",
      // What the topic SAYS: "stacked", "grouped bar" find the charts
      // topic even though its title is just "Charts".
      body: topic.text,
      action: () => openHelp(topic.file),
    });
  }
  return entries;
}

/**
 * How well a help topic's text answers a search: the whole query
 * verbatim, else each word found as the start of a word in the text.
 */
function bodyScore(query: string, body: string): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const esc = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const asWord = (w: string): boolean =>
    new RegExp(`(^|[^a-z0-9])${esc(w)}`).test(body);
  if (body.includes(q) && words.every(asWord)) return 10 + 2 * q.length;
  if (words.length > 1 && words.every(asWord)) {
    return 8 + 2 * words.reduce((n, w) => n + w.length, 0);
  }
  return body.includes(q) ? 6 : -1;
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
  // Scored as the contiguous run it is - walking letter by letter
  // took the FIRST g for "guide" (in "Getting") and scattered the
  // rest, so "Getting started guide" lost to any help topic.
  const at = h.indexOf(n);
  if (at >= 0) {
    const wordAt = new RegExp(
      `(^|[ .:-])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    ).exec(h);
    return 10 + 3 * n.length + (wordAt ? 4 : 0);
  }
  let score = 0;
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
    tag.textContent = entry.tag ?? entry.group;
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

/** A page (or chapter...) typed after a reference's name in the
 * citation picker: "Cite: Knuth p. 99" cites `[@knuth1984, p. 99]`. */
let paletteLocator = "";
const paletteFoot = requireEl<HTMLElement>("#palette-modal .palette-foot");
const PALETTE_FOOT = paletteFoot.textContent;
const LOCATOR_RE =
  /(?:,\s*|\s+)((?:pp?|ch|chap|sec|para|fig|vol|n|note)\.?\s*\d[\w\u2013-]*(?:\s*[-\u2013]\s*\w+)?)\s*$/i;

function updatePalette(): void {
  let query = paletteInput.value.trim();
  paletteLocator = "";
  if (/^cite:/i.test(query)) {
    const m = LOCATOR_RE.exec(query);
    if (m) {
      paletteLocator = (m[1] ?? "").replace(
        /^(pp?|ch|chap|sec|para|fig|vol|n|note)\.?\s*/i,
        "$1. ",
      );
      query = query.slice(0, m.index).trim();
    }
  }
  paletteFoot.textContent = /^cite:/i.test(query)
    ? `Enter to cite${paletteLocator ? ` with ${paletteLocator}` : ""} · add a page after the name: "Knuth p. 99" · Esc to close`
    : PALETTE_FOOT;
  const all = paletteEntries();
  if (!query) {
    // Every command, then a taste of each other group - a growing
    // command list must never push sections and help out of sight.
    const commands = all.filter((e) => e.group === "Command");
    const sections = all.filter((e) => e.group === "Section").slice(0, 10);
    const help = all.filter((e) => e.group === "Help").slice(0, 10);
    paletteFiltered = [...commands, ...sections, ...help];
  } else {
    // A search that goes past the command word: "cite knuth", "Cite: ".
    const targeted = query.includes(":") || query.split(/\s+/).length > 1;
    paletteFiltered = all
      .map((e) => ({
        e,
        s:
          Math.max(
            fuzzyScore(query, `${e.title} ${e.keywords}`),
            // Words in the TITLE beat the same words among the keywords:
            // "new" is New document, not every command tagged "new".
            e.title.toLowerCase().includes(query.toLowerCase())
              ? fuzzyScore(query, e.title) + 5
              : -1,
            // A help topic whose TEXT has the query - verbatim, or every
            // word of it as a word ("pmt", "loan payment") - above a
            // scattered-letter match, below a title/keyword hit.
            e.body ? bodyScore(query, e.body) : -1,
            // Every word of the query among the title and keywords, in
            // any order: "fewer rows" finds "Choose how many rows a
            // table shows" (tagged "fewer"), which letter-by-letter
            // matching missed.
            bodyScore(query, `${e.title} ${e.keywords}`.toLowerCase()),
            // ...and SEVERAL words all in the TITLE beat the same words
            // among the keywords: "compute python" is "Insert a compute
            // block (Python)", not an example tagged "compute python".
            // One word in a title is weak evidence - "cite" is still
            // the command, not every "Cite: ..." target.
            /\s/.test(query.trim()) &&
              bodyScore(query, e.title.toLowerCase()) > 0
              ? bodyScore(query, e.title.toLowerCase()) + 30
              : -1,
          ) -
          // "Cross-reference: Regional summary" must not outrank the
          // section itself, nor "Cite: Knuth 1984" the "Insert a
          // citation" command: one target per row ranks last unless
          // the search names one ("cite knuth", "Cite: Knuth").
          (e.title.startsWith("Cross-reference:") &&
          !(targeted && /^(cross|ref|see)/i.test(query))
            ? 20
            : 0) -
          (e.title.startsWith("Cite:") &&
          !(targeted && /^(cite|cita|ref|bib)/i.test(query))
            ? 20
            : 0),
      }))
      .filter((x) => x.s > 0)
      // Equal scores: the more specific help topic (less text), then
      // the shorter title - the more general command ("Import data"
      // before "Import the demo dataset").
      .sort(
        (a, b) =>
          b.s - a.s ||
          (a.e.body?.length ?? 0) - (b.e.body?.length ?? 0) ||
          a.e.title.length - b.e.title.length,
      )
      .map((x) => x.e)
      .slice(0, 30);
  }
  paletteSel = 0;
  renderPalette();
}

/** Open the palette - optionally with a search already typed (the
 * Insert menu's Cross-reference opens it on the targets). */
function openPalette(query?: unknown): void {
  if (paletteModal.open) return;
  el.saveCaret();
  paletteModal.showModal();
  paletteInput.value = typeof query === "string" ? query : "";
  updatePalette();
  paletteInput.focus();
}

requireEl<HTMLButtonElement>("#btn-search").addEventListener(
  "click",
  openPalette,
);

document.addEventListener("keydown", (ev) => {
  if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) return;
  const key = ev.key.toLowerCase();
  if (key === "k") {
    ev.preventDefault();
    openPalette();
  }
  // Ctrl+P prints everywhere: a browser binds it, but the desktop
  // app's webview (WebKitGTK) does not.
  if (key === "p") {
    ev.preventDefault();
    printDocument();
  }
  // Ctrl+S / Ctrl+O: Save and Open, in the browser too (its own
  // Ctrl+S would save the web page, not the document).
  if (key === "s" || key === "o") {
    ev.preventDefault();
    (key === "s" ? btnSave : btnOpen).click();
  }
  // Ctrl+N: a new document. (A browser keeps Ctrl+N for a new window;
  // the desktop app has no such binding, so there it is folio's.)
  if (key === "n") {
    ev.preventDefault();
    void openShipped(null);
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
const setCitationStyle = requireEl<HTMLSelectElement>("#set-citation-style");
const setPalette = requireEl<HTMLSelectElement>("#set-palette");
const setPbH1 = requireEl<HTMLSelectElement>("#set-pb-h1");
const setPbH2 = requireEl<HTMLSelectElement>("#set-pb-h2");
const setPageNumbers = requireEl<HTMLSelectElement>("#set-page-numbers");
const setPageHeader = requireEl<HTMLSelectElement>("#set-page-header");
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
  named(setCitationStyle, look.citationStyle);
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
  setCitationStyle,
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
  fillOptions(setCitationStyle, CITATION_STYLES, style.get("citation.style"));
  fillOptions(setPalette, Object.keys(PALETTES), style.get("chart.palette"));
  setPbH1.value = style.get("pagebreak.h1") === "before" ? "before" : "default";
  setPbH2.value = style.get("pagebreak.h2") === "before" ? "before" : "default";
  setPageNumbers.value =
    style.get("page.numbers") === "off" ? "off" : "default";
  setPageHeader.value = style.get("page.header") === "off" ? "off" : "default";
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
      "citation.style": setCitationStyle.value,
      "chart.palette": setPalette.value,
      "pagebreak.h1": setPbH1.value,
      "pagebreak.h2": setPbH2.value,
      "page.numbers": setPageNumbers.value,
      "page.header": setPageHeader.value,
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
function preparePrint(): void {
  // A cell still being typed in recalculates first: paper shows
  // current figures.
  el.flushEdits();
  if (paletteModal.open) paletteModal.close();
  if (settingsModal.open) settingsModal.close();
  if (!mdWrap.hidden) btnView.click();
  // Paper is light whatever the app's mode: a dark rendition's charts
  // and diagrams would print pale-on-white. Restored after printing.
  for (const doc of Array.from(document.querySelectorAll("folio-doc"))) {
    doc.setAttribute("mode", "light");
  }
  // The running header and page numbers, as @page margin boxes - they
  // only apply from the document's own stylesheet.
  printFurnitureStyle.textContent = furnitureCss(
    furnitureFor(el.getDoc()),
    furnitureFont(el.getDoc()),
  );
}
const printFurnitureStyle = document.head.appendChild(
  document.createElement("style"),
);
printFurnitureStyle.id = "print-furniture";
window.addEventListener("beforeprint", preparePrint);
window.addEventListener("afterprint", reflectMode);

/**
 * Print. The desktop app's print dialog (WebKitGTK) leaves off page
 * numbers and the running header - only Export adds them (ADR-0027) -
 * so it says where to find them.
 */
function printDocument(): void {
  if (isDesktop()) {
    flash("For page numbers, use Export as PDF");
  }
  const remind = personalUseReminder();
  if (remind) {
    // The print dialog would cover the reminder at once: let it be
    // read first.
    flash(remind);
    setTimeout(() => window.print(), 1200);
    return;
  }
  window.print();
}

/* --- Export (spec: docs/specs/print.md, ADR-0025) --- */

/** Every figure drawn (charts, diagrams, models): an export must not
 * catch one saying "Drawing…". Gives up after `ms`. */
async function drawingsSettled(ms = 15000): Promise<void> {
  const busy = (): boolean =>
    Array.from(
      el.shadowRoot?.querySelectorAll(".code-view, .jscad-view") ?? [],
    ).some((n) =>
      /^(Drawing…|Building the model…)$/.test(n.textContent?.trim() ?? ""),
    );
  const end = Date.now() + ms;
  while (busy() && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** The file name a PDF is offered as: the open file's, else the title. */
function pdfName(): string {
  return suggestedName("pdf");
}

/**
 * Export as PDF. The desktop app writes the file itself (a save
 * dialog, then the print stylesheet straight to PDF - no print
 * dialog). A browser can only print, so there the print dialog
 * opens, with a word on choosing "Save as PDF".
 */
/** Before a document leaves the user's hands: say if it holds data
 * imported for personal use only (a reminder, never a block). */
function personalUseReminder(): string {
  const tables = el.personalUseTables();
  return tables.length
    ? `This document contains personal-use data (${tables.join(", ")}) - check its terms before sharing`
    : "";
}

async function exportPdf(): Promise<void> {
  preparePrint();
  await el.drawn();
  await drawingsSettled();
  if (isDesktop()) {
    flash("Exporting…");
    const res = await exportPdfFile(pdfName(), furnitureFor(el.getDoc()));
    reflectMode();
    if (res.ok) {
      const remind = personalUseReminder();
      flash(`Exported ${res.path}${remind ? `. ${remind}` : ""}`);
      return;
    }
    if (res.reason === "cancelled") return;
    if (res.reason !== "unsupported") {
      flash(`Could not export: ${res.reason}`);
      return;
    }
  }
  const remind = personalUseReminder();
  flash(
    `Choose "Save as PDF" as the destination${remind ? `. ${remind}` : ""}`,
  );
  // With a reminder, let it be read before the dialog covers it.
  if (remind) setTimeout(() => window.print(), 1200);
  else window.print();
}

requireEl<HTMLButtonElement>("#btn-export-pdf").addEventListener(
  "click",
  () => {
    void exportPdf();
  },
);

refreshOutline();

/* --- Toolbar: menus, overflow, window title (spec: docs/specs/toolbar.md) --- */

document.documentElement.classList.toggle("desktop", isDesktop());

// Header buttons never take focus from the document: after a click
// on the mode or settings button, typing still goes into the page
// (it went nowhere, and a typed title was lost). Keyboard focus by
// Tab still works - this only cancels focus-on-press.
requireEl<HTMLElement>("header").addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (btn && !btn.closest(".menu")) ev.preventDefault();
});

requireEl<HTMLButtonElement>("#btn-new").addEventListener("click", () => {
  void openShipped(null);
});

/**
 * A toolbar menu: opens under its trigger, closes on a pick, a click
 * elsewhere, or Esc. The trigger acts on mousedown and cancels it so
 * the document keeps its caret - menu items act on the caret just as
 * the toolbar buttons they were did.
 */
function toolbarMenu(trigger: HTMLButtonElement, menu: HTMLElement): void {
  const close = (): void => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    const open = menu.hidden;
    closeMenus(trigger);
    if (open) {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      placeMenu(trigger, menu);
    }
  });
  // Keyboard: Enter/Space on a focused trigger.
  trigger.addEventListener("click", (ev) => {
    if (ev.detail !== 0) return; // a mouse press was handled above
    const open = menu.hidden;
    closeMenus(trigger);
    if (open) {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      placeMenu(trigger, menu);
      menu.querySelector<HTMLButtonElement>("button:not([hidden])")?.focus();
    }
  });
  // A pick closes the menu - after the item's own handler ran (they
  // act on mousedown or click).
  menu.addEventListener("click", (ev) => {
    // (A menu's own trigger inside it - Export in More tools - opens
    // a menu; it is not a pick.)
    const btn = (ev.target as HTMLElement).closest("button");
    if (btn && !btn.classList.contains("menu-trigger")) close();
  });
  menu.addEventListener("mousedown", (ev) => {
    // Items never take focus from the document's caret.
    if ((ev.target as HTMLElement).closest("button")) ev.preventDefault();
  });
  menus.push({ menu, close });
}

/** Below its trigger, left-aligned with it, but always on screen. */
function placeMenu(trigger: HTMLElement, menu: HTMLElement): void {
  const t = trigger.getBoundingClientRect();
  const top = t.bottom + 8;
  menu.style.top = `${String(top)}px`;
  menu.style.maxHeight = `${String(window.innerHeight - top - 12)}px`;
  menu.style.left = "0px";
  const w = menu.offsetWidth;
  const left = Math.max(8, Math.min(t.left - 4, window.innerWidth - w - 8));
  menu.style.left = `${String(left)}px`;
}

const menus: { menu: HTMLElement; close: () => void }[] = [];
/** Close the open menus - except those holding `keep` (a menu opened
 * from inside More tools keeps More tools open). */
function closeMenus(keep?: HTMLElement): void {
  for (const m of menus) if (!keep || !m.menu.contains(keep)) m.close();
}
document.addEventListener("mousedown", (ev) => {
  const t = ev.target as HTMLElement;
  if (!t.closest(".menu-wrap")) closeMenus();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeMenus();
});
// Placed against the window: a resize would leave them adrift.
window.addEventListener("resize", () => closeMenus());

toolbarMenu(
  requireEl<HTMLButtonElement>("#btn-style-menu"),
  requireEl<HTMLElement>("#style-menu"),
);
toolbarMenu(
  requireEl<HTMLButtonElement>("#btn-insert-menu"),
  requireEl<HTMLElement>("#insert-menu"),
);
toolbarMenu(
  requireEl<HTMLButtonElement>("#btn-export-menu"),
  requireEl<HTMLElement>("#export-menu"),
);
toolbarMenu(
  requireEl<HTMLButtonElement>("#btn-overflow"),
  requireEl<HTMLElement>("#overflow-menu"),
);

// Citation: the palette, opened on the bibliography's references - or,
// with none yet, a word on where they come from.
function openCitePicker(): void {
  if (el.citationChoices().length === 0) {
    flash(
      "No references yet - Insert › Bibliography, then paste BibTeX from Google Scholar or Zotero",
    );
    return;
  }
  openPalette("Cite: ");
}

requireEl<HTMLButtonElement>("#btn-insert-cite").addEventListener(
  "click",
  () => {
    closeMenus();
    openCitePicker();
  },
);

// Cross-reference: the palette, opened on the things it can name -
// or, when there are none, a word on how to make one.
function openCrossRefPicker(): void {
  if (el.crossRefChoices().length === 0) {
    flash(
      "Nothing to refer to yet - add a heading, or a table or chart with a caption",
    );
    return;
  }
  openPalette("Cross-reference: ");
}

// Cross-reference: the palette, opened on the things it can name.
requireEl<HTMLButtonElement>("#btn-insert-xref").addEventListener(
  "click",
  () => {
    closeMenus();
    openCrossRefPicker();
  },
);

// Inserts that live only in the palette run the palette's own action:
// one implementation, two ways in.
for (const item of Array.from(
  document.querySelectorAll<HTMLButtonElement>("#insert-menu [data-insert]"),
)) {
  item.addEventListener("click", () => {
    paletteEntries()
      .find((e) => e.title === item.dataset.insert)
      ?.action();
  });
}

// The style menu's trigger names the style at the caret.
const styleLabel = requireEl<HTMLElement>("#style-label");
const styleLabelShort = requireEl<HTMLElement>("#style-label-short");
const STYLE_NAMES: Record<string, string> = {
  p: "Paragraph",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
};
function reflectStyleLabel(): void {
  const active = blockBar.querySelector<HTMLElement>(
    "#style-menu button.active",
  );
  const block = active?.dataset.block ?? "p";
  styleLabel.textContent = STYLE_NAMES[block] ?? "Paragraph";
  styleLabelShort.textContent = block.toUpperCase();
}
new MutationObserver(reflectStyleLabel).observe(
  requireEl<HTMLElement>("#style-menu"),
  { attributes: true, attributeFilter: ["class"], subtree: true },
);

/**
 * One row at every width: when the toolbar does not fit, whole groups
 * move into "More tools" (the ⋯ menu) - least used first, by their
 * data-overflow rank - and come back when there is room. The groups
 * keep their ids and handlers; only their place changes.
 */
const toolbarEl = requireEl<HTMLElement>(".toolbar");
const overflowWrap = requireEl<HTMLElement>("#overflow-wrap");
const overflowMenu = requireEl<HTMLElement>("#overflow-menu");
// In bar order; `byRank` is the order they leave in.
const collapsible = Array.from(
  toolbarEl.querySelectorAll<HTMLElement>(":scope > [data-overflow]"),
).map((node) => ({
  node,
  rank: Number(node.dataset.overflow),
  // Where it lives in the bar, to put it back.
  marker: document.createComment(`slot ${node.id || "group"}`),
}));
const byRank = [...collapsible].sort((a, b) => a.rank - b.rank);
for (const c of collapsible) c.node.before(c.marker);

function fitToolbar(): void {
  // Everything home first, then out again in rank order until it fits.
  for (const c of collapsible) c.marker.after(c.node);
  overflowMenu.textContent = "";
  overflowWrap.hidden = true;
  const fits = (): boolean => toolbarEl.scrollWidth <= toolbarEl.clientWidth;
  if (fits()) {
    overflowMenu.hidden = true;
    return;
  }
  overflowWrap.hidden = false;
  const moved = new Set<(typeof collapsible)[number]>();
  for (const c of byRank) {
    if (fits()) break;
    moved.add(c);
    c.node.remove();
  }
  // A smaller group may fit again now that a larger one has gone
  // (undo/redo, once B I S U are out): most important first.
  for (const c of [...byRank].reverse()) {
    if (!moved.has(c)) continue;
    c.marker.after(c.node);
    if (fits()) moved.delete(c);
    else c.node.remove();
  }
  // In the menu, in their bar order: a group as a labelled row
  // ("Format  B I S U"), a lone button as a row with its own label.
  for (const c of collapsible) {
    if (!moved.has(c)) continue;
    const label = c.node.dataset.label;
    if (!label) {
      overflowMenu.appendChild(c.node);
      continue;
    }
    const row = document.createElement("div");
    row.className = "overflow-row";
    const name = document.createElement("span");
    name.className = "overflow-label";
    name.textContent = label;
    row.append(name, c.node);
    overflowMenu.appendChild(row);
  }
}
new ResizeObserver(fitToolbar).observe(requireEl<HTMLElement>("header"));
fitToolbar();

/**
 * The window title names the document: "Q3 Sales Review — folio" in
 * the browser tab and the desktop title bar.
 */
let shownTitle = "";
function reflectTitle(): void {
  const h1 = el
    .getOutline()
    .find((e) => e.level === 1)
    ?.text.trim();
  const title = `${h1 || "Untitled"} — folio`;
  if (title === shownTitle) return;
  shownTitle = title;
  document.title = title;
  if (isDesktop()) {
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
      getCurrentWindow().setTitle(title),
    );
  }
}
el.onChange(reflectTitle);

// Last: booting can finish synchronously (a blank document fetches
// nothing), so everything above must exist first.
void boot();
