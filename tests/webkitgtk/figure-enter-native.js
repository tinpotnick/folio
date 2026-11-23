// native-key: Return t e s t
// With a figure as the LAST block, a REAL Enter with the figure
// selected must open a paragraph BELOW it and typing lands there.
// One predicate (isFigureBlock over BLOCK_CLASS, src/engine/doc.ts)
// covers every figure kind - image, math, diagram, comment, ...
// (spec: docs/specs/block-schema.md). The figure is selected the way
// a click does it: mousedown on it (lastBlock) plus a selection
// spanning the non-editable element - setBaseAndExtent, because
// addRange drops shadow nodes on WebKitGTK.
const host = document.querySelector("#the-doc");
await host.load(
  '# T\n\nPara text\n\n::: image {#image-1}\nsrc: https://example.com/x.png\nalt: "x"\n:::\n',
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const art = root.querySelector("article");
const fig = root.querySelector("figure.folio-image");
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
  const last = blocks[blocks.length - 1];
  return [
    "",
    "real Enter opened a paragraph below the trailing image: " +
      (last.kind === "prose" ? "true" : "false"),
    "typing landed in the new paragraph: " +
      (last.text === "test" ? "true" : "false"),
    "image still directly above it: " +
      (blocks[blocks.length - 2]?.kind === "image" ? "true" : "false"),
    "paragraph above untouched: " +
      (blocks[1]?.kind === "prose" && blocks[1].text === "Para text"
        ? "true"
        : "false"),
  ].join(" | ");
};
return "set";
