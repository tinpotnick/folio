// native-key: BackSpace
// A flashcards deck is a figure block (BLOCK_CLASS, src/engine/doc.ts):
// with the figure selected (mousedown + a selection spanning the
// non-editable element, because addRange drops shadow nodes on
// WebKitGTK), a REAL Backspace must remove the deck block - the same
// edge contract as image/audio figures (specs: block-schema.md,
// flashcards.md). The card rows must never become an editing surface.
const host = document.querySelector("#the-doc");
await host.load(
  '# T\n\nPara\n\n::: flashcards {#deck-1}\ntitle: "Animals"\ncard: "perro" | "dog"\ncard: "gato" | "cat"\n:::\n',
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const art = root.querySelector("article");
const fig = root.querySelector("figure.folio-flashcards");
const editable = fig.isContentEditable;
const rows = fig.querySelectorAll(".folio-fc-row").length;
const r = fig.getBoundingClientRect();
fig.dispatchEvent(
  new MouseEvent("mousedown", {
    bubbles: true,
    composed: true,
    clientX: r.left + 5,
    clientY: r.top + 5,
  }),
);
art.focus();
document.getSelection().setBaseAndExtent(fig, 0, fig, fig.childNodes.length);
window.__folioCheck = () => {
  const blocks = host.getDoc().blocks;
  return [
    "",
    "deck figure is contentEditable=false: " + !editable,
    "two card rows rendered: " + (rows === 2),
    "real Backspace removed the deck block: " +
      (blocks.length === 2 && blocks.every((b) => b.kind !== "flashcards")),
    "heading and paragraph untouched: " +
      (blocks[0]?.kind === "heading" && blocks[1]?.text === "Para"),
  ].join(" | ");
};
return "set";
