// Python compute blocks in the desktop engine: the sandbox worker
// loads the bundled Pyodide runtime (fetch kept for /pyodide/ only)
// and the block's returned table renders as the figure.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const host = document.querySelector("#the-doc");
await host.load(
  [
    "# T",
    "",
    "::: table {#budget}",
    "columns:",
    "  - {name: item, type: text}",
    "  - {name: cost, type: number}",
    "data:",
    "  - [A, 30]",
    "  - [B, 12]",
    ":::",
    "",
    "```python data=@budget out=totals",
    'return [{ "item": "Total", "cost": sum(r["cost"] for r in budget) }]',
    "```",
    "",
  ].join("\n"),
);
const view = () =>
  host.shadowRoot.querySelector("figure.folio-python .code-view");
for (let i = 0; i < 100 && !view()?.querySelector(".compute-table"); i++) {
  if (view()?.classList.contains("drawn-error")) break;
  await wait(200);
}
const text = view()?.textContent ?? "";
return (
  "| Python ran in WebKitGTK: " +
  text.includes("42") +
  " | no compute error: " +
  !text.includes("Compute error")
);
