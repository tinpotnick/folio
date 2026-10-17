/**
 * Demo host app (ADR-0006: our apps are hosts of the component).
 * Document view / Markdown view toggle; edits in either mode keep
 * the document as the source of truth.
 */
import "./component.js";
import type { FolioDoc } from "./component.js";
import { parseDoc, serializeDoc } from "./engine/doc.js";

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

async function boot(): Promise<void> {
  const res = await fetch("/demo/sample-document.md");
  const text = await res.text();
  el.load(text);
  editor.value = text;
}

function flash(msg: string): void {
  status.textContent = msg;
  status.classList.add("show");
  setTimeout(() => status.classList.remove("show"), 1200);
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
  el.hidden = false;
  btnView.classList.add("active");
  btnMd.classList.remove("active");
});

btnMd.addEventListener("click", () => {
  const md = el.getMarkdown();
  if (md !== null) editor.value = md;
  editor.hidden = false;
  el.hidden = true;
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
