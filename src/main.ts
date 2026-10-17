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

const fmtBar = requireEl<HTMLElement>("#fmt-bar");
fmtBar.addEventListener("mousedown", (ev) => {
  const btn = (ev.target as HTMLElement).closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;
  ev.preventDefault();
  const active = document.querySelector<HTMLElement>(
    "folio-doc [contenteditable='true']:focus",
  );
  if (!active) {
    flash("Click into the text first");
    return;
  }
  if (btn.dataset.cmd === "code") {
    document.execCommand("formatBlock", false, "pre");
  } else {
    document.execCommand(btn.dataset.cmd ?? "");
  }
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
