// Python compute blocks in the desktop engine: the sandbox worker
// loads the bundled Pyodide runtime (fetch kept for /pyodide/ only),
// runs the script, and the block's status line names what it
// published (ADR-0030).
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
    "```python data=@budget out=total",
    'total = sum(budget.col("cost"))',
    "```",
    "",
  ].join("\n"),
);
const status = () =>
  host.shadowRoot.querySelector("figure.folio-compute .compute-status");
for (let i = 0; i < 100; i++) {
  const t = status()?.textContent ?? "";
  if (t.startsWith("→") || t.startsWith("Compute error")) break;
  await wait(200);
}
const text = status()?.textContent ?? "";
return (
  "| Python ran in WebKitGTK: " +
  (text === "→ @total = 42") +
  " | no compute error: " +
  !text.includes("Compute error")
);
