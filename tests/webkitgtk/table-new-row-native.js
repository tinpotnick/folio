// native-key: Return
// A REAL Enter in the bottom row grows the table; leaving the new row
// blank (a press in the text) takes it away again. WebKitGTK keeps
// the caret in the old cell after Enter, so the new row is only ever
// left by a press - the path this checks.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\n::: table {#t}\ncolumns:\n  - {name: a, type: number}\ndata:\n  - [1]\n:::\n",
);
await new Promise((r) => setTimeout(r, 100));
const root = host.shadowRoot;
const rows = () =>
  root.querySelectorAll("figure[data-table-id='t'] tbody tr").length;
const cell = root.querySelector(
  "figure[data-table-id='t'] td[data-row-index='0']",
);
cell.focus();
window.__folioCheck = async () => {
  const grown = rows();
  const h1 = root.querySelector("article h1").getBoundingClientRect();
  const at = {
    clientX: h1.left + 5,
    clientY: h1.top + 5,
    bubbles: true,
    composed: true,
  };
  root
    .querySelector("article h1")
    .dispatchEvent(new MouseEvent("mousedown", at));
  root.querySelector("article h1").dispatchEvent(new MouseEvent("mouseup", at));
  await new Promise((r) => setTimeout(r, 50));
  return (
    "| real Enter grows the table: " +
    (grown === 2) +
    " | the blank row goes when left: " +
    (rows() === 1)
  );
};
return "set";
