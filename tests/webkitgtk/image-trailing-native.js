// native-key: Down t e s t
// With an image as the LAST block, the figure is not a caret target:
// ArrowDown from the end of the paragraph above must open a new
// paragraph BELOW the image, and typing lands there - not appended to
// the paragraph above, and not lost. Real keys, because only the
// engine knows what ArrowDown does at a non-editable block's edge.
const host = document.querySelector("#the-doc");
await host.load(
  '# T\n\nPara text\n\n::: image {#image-1}\nsrc: https://example.com/x.png\nalt: "x"\n:::\n',
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const art = root.querySelector("article");
const p = art.querySelector(":scope > p");
const t = p.firstChild;
art.focus();
document
  .getSelection()
  .setBaseAndExtent(t, t.textContent.length, t, t.textContent.length);
window.__folioCheck = () => {
  const blocks = host.getDoc().blocks;
  const last = blocks[blocks.length - 1];
  const r = document
    .getSelection()
    .getComposedRanges({ shadowRoots: [root] })[0];
  const el =
    r &&
    (r.startContainer instanceof Element
      ? r.startContainer
      : r.startContainer.parentElement);
  const blk = el?.closest("[data-block-index]");
  return [
    "",
    "new paragraph typed below trailing image: " +
      (last.kind === "prose" && last.text === "test" ? "true" : "false"),
    "image still directly above it: " +
      (blocks[blocks.length - 2]?.kind === "image" ? "true" : "false"),
    "paragraph above untouched: " +
      (blocks[1]?.kind === "prose" && blocks[1].text === "Para text"
        ? "true"
        : "false"),
    "caret in the new paragraph: " +
      (blk && Number(blk.getAttribute("data-block-index")) === blocks.length - 1
        ? "true"
        : "false"),
  ].join(" | ");
};
return "set";
