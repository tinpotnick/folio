// The desktop engine: a click into a cell of a model's dataset (the
// component focuses the cell on mouseup) switches the model to that
// row - the focusin path the follow hangs on.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const host = document.querySelector("#the-doc");
await host.load(
  [
    "# T",
    "",
    "::: table {#sizes}",
    "columns:",
    "  - {name: size, type: text}",
    "  - {name: length, type: number}",
    "data:",
    "  - [small, 20]",
    "  - [large, 60]",
    ":::",
    "",
    "```jscad params=@sizes",
    "const { cuboid } = require('@jscad/modeling').primitives",
    "const main = ({ length }) => cuboid({ size: [length, 10, 10] })",
    "module.exports = { main }",
    "```",
    "",
  ].join("\n"),
);
await wait(1500);
const root = host.shadowRoot;
const td = root.querySelector(
  'figure[data-table-id="sizes"] td[data-row-index="1"][data-col-index="1"]',
);
const r = td.getBoundingClientRect();
const at = {
  clientX: r.left + 4,
  clientY: r.top + 4,
  bubbles: true,
  composed: true,
};
td.dispatchEvent(new MouseEvent("mousedown", at));
td.dispatchEvent(new MouseEvent("mouseup", at));
await wait(1500);
const model = host.getDoc().blocks.find((b) => b.kind === "code");
return (
  "| a click on row 2 binds the model to it: " +
  (model?.info === "params=@sizes row=2")
);
