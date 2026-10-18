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
const btnDl = requireEl<HTMLButtonElement>("#btn-download");
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

editor.addEventListener("input", renderHighlight);

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

const blockBar = requireEl<HTMLElement>("#block-bar");
blockBar.addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;
  ev.preventDefault();
  if (!currentEditable()) {
    flash("Click into the text first");
    return;
  }
  if (btn.dataset.block) {
    document.execCommand("formatBlock", false, `<${btn.dataset.block}>`);
  }
  el.dispatchEvent(new Event("input"));
});

const fmtBar = requireEl<HTMLElement>("#fmt-bar");
fmtBar.addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;
  ev.preventDefault();
  if (!currentEditable()) {
    flash("Click into the text first");
    return;
  }
  if (btn.dataset.cmd === "code") {
    document.execCommand("formatBlock", false, "pre");
  } else {
    document.execCommand(btn.dataset.cmd ?? "");
  }
  el.dispatchEvent(new Event("input"));
});

function reflectToolbarState(): void {
  const inDoc = currentEditable() !== null;
  const blockButtons = blockBar.querySelectorAll("button");
  const fmtButtons = fmtBar.querySelectorAll("button");
  if (!inDoc) {
    blockButtons.forEach((b) => b.classList.remove("active"));
    fmtButtons.forEach((b) => b.classList.remove("active"));
    return;
  }
  const sel = window.getSelection();
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
}

document.addEventListener("selectionchange", () => {
  const root = el.shadowRoot;
  if (root?.activeElement?.tagName === "ARTICLE") {
    setTimeout(reflectToolbarState, 0);
  }
});
el.addEventListener("pointerup", () => setTimeout(reflectToolbarState, 0));
el.addEventListener("keyup", () => setTimeout(reflectToolbarState, 0));

const btnTable = requireEl<HTMLButtonElement>("#btn-table");
btnTable.addEventListener("click", () => {
  el.insertTable();
  flash("Table inserted");
});

btnDl.addEventListener("click", () => {
  const md = el.getMarkdown();
  if (md === null) return;
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "document.md";
  a.click();
  URL.revokeObjectURL(a.href);
  flash("Downloaded document.md");
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
  btnDl.hidden = true;
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
