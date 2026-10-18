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
  const mark = cmd === "bold" ? "**" : cmd === "italic" ? "*" : "`";
  if (currentEditable()) {
    if (cmd === "code") {
      document.execCommand("formatBlock", false, "pre");
    } else {
      document.execCommand(cmd);
    }
    el.dispatchEvent(new Event("input"));
  } else if (document.activeElement === editor) {
    toggleMdWrap(mark);
  } else {
    flash("Click into the text first");
  }
});

function reflectToolbarState(): void {
  const inDoc = currentEditable() !== null;
  const inMd = document.activeElement === editor;
  const blockButtons = blockBar.querySelectorAll("button");
  const fmtButtons = fmtBar.querySelectorAll("button");
  if (!inDoc && !inMd) {
    blockButtons.forEach((b) => b.classList.remove("active"));
    fmtButtons.forEach((b) => b.classList.remove("active"));
    return;
  }
  if (inDoc) {
    // document.getSelection() is adjusted to the light DOM when the
    // caret is inside the component's shadow root; the real anchor
    // comes from the shadow root's own selection.
    const shadowSel = (
      el.shadowRoot as ShadowRootWithSelection | null
    )?.getSelection?.();
    const sel = shadowSel ?? window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    const root = el.shadowRoot;
    const host = root?.querySelector("article.folio-doc") ?? null;
    while (node && node.parentNode && node.parentNode !== host) {
      node = node.parentNode;
    }
    const tag = node instanceof HTMLElement ? node.tagName : "";
    blockButtons.forEach((b) => {
      const want =
        b.dataset.block === "p" ? "P" : (b.dataset.block ?? "").toUpperCase();
      b.classList.toggle("active", tag === want);
    });
    fmtButtons.forEach((b) => {
      const cmd = b.dataset.cmd ?? "";
      if (cmd === "code") {
        b.classList.toggle(
          "active",
          node instanceof HTMLElement ? node.tagName === "PRE" : false,
        );
      } else {
        try {
          b.classList.toggle("active", document.queryCommandState(cmd));
        } catch {
          b.classList.remove("active");
        }
      }
    });
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
      if (tok.kind === "bold" || tok.kind === "italic" || tok.kind === "code") {
        fmt = tok.kind;
      }
      break;
    }
    acc = tokEnd;
  }
  fmtButtons.forEach((b) => {
    b.classList.toggle(
      "active",
      (b.dataset.cmd ?? "") !== "" && b.dataset.cmd === fmt,
    );
  });
}

document.addEventListener("selectionchange", () => {
  const root = el.shadowRoot;
  if (root?.activeElement?.tagName === "ARTICLE") {
    setTimeout(reflectToolbarState, 0);
  }
});
el.addEventListener("pointerup", () => setTimeout(reflectToolbarState, 0));
el.addEventListener("keyup", () => setTimeout(reflectToolbarState, 0));
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
    c !== undefined && /\S/.test(c) && c !== "*" && c !== "`";
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
