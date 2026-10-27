// native-key: End 2 3 Tab
// Typing in a cell in the desktop engine with REAL keys: the formula
// beside it does not recalculate per letter (that took a beat per
// keystroke on big documents), and does once Tab leaves the cell.
const host = document.querySelector("#the-doc");
await host.load(
  '# T\n\n::: table {#t}\ncolumns:\n  - {name: a, type: number}\n  - {name: b, type: formula, expr: "a * 2"}\ndata:\n  - [1, ""]\n  - [2, ""]\n:::\n',
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const cell = (r, c) =>
  root.querySelector(`td[data-row-index="${r}"][data-col-index="${c}"]`);
const a = cell(0, 0);
// Every value the formula cell shows, as it changes.
const shown = new Set([cell(0, 1).textContent]);
new MutationObserver(() => shown.add(cell(0, 1)?.textContent ?? "")).observe(
  root.querySelector("article"),
  { subtree: true, characterData: true, childList: true },
);
a.focus();
document.getSelection().setBaseAndExtent(a.firstChild, 1, a.firstChild, 1);
window.__folioCheck = () =>
  "| the formula recalculated after Tab: " +
  (cell(0, 1).textContent === "246") +
  "\n| the source has the typed value: " +
  host.getMarkdown().includes("  - [123, ") +
  // "24" would be the result of the half-typed "12".
  "\n| no half-typed value was calculated: " +
  !shown.has("24");
