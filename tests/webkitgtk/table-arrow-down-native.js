// native-key: Down
// A REAL ArrowDown keypress in WebKitGTK: caret from r1c0 to r2c0,
// same column, and the table must NOT grow a row.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\n::: table {#t}\ncolumns:\n  - {name: a, type: text}\n  - {name: b, type: number}\ndata:\n  - [one, 1]\n  - [two, 2]\n  - [three, 3]\n:::\n",
);
await new Promise((r) => setTimeout(r, 400));
const root = host.shadowRoot;
root.querySelector('td[data-row-index="1"][data-col-index="0"]').focus();
await new Promise((r) => setTimeout(r, 150));
window.__folioCheck = () => {
  const sel = document.getSelection();
  const rg = sel.getComposedRanges({ shadowRoots: [root] })[0];
  const n = rg?.startContainer;
  const el = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
  const cell = el && el.closest ? el.closest("td[data-row-index]") : null;
  const rows = root.querySelectorAll("tbody tr").length;
  return (
    "| ArrowDown moved the caret to r2c0 (same column): " +
    !!(cell && cell.dataset.rowIndex === "2" && cell.dataset.colIndex === "0") +
    "\n| arrows did not grow the table (still 3 rows): " +
    (rows === 3)
  );
};
return "armed";
