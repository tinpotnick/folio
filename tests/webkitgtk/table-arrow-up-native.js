// native-key: Up
// A REAL ArrowUp keypress in WebKitGTK (the desktop engine): with a
// table cell focused, the caret must move one row UP in the SAME
// column. Before the fix the component preventDefaulted but could not
// move the caret (no ShadowRoot.getSelection), so it stayed put.
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
  return (
    "| ArrowUp moved the caret to r0c0 (same column): " +
    !!(cell && cell.dataset.rowIndex === "0" && cell.dataset.colIndex === "0")
  );
};
return "armed";
