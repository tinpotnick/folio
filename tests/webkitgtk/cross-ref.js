// Cross-references in the desktop engine: captions numbered, references
// filled in, and inserting one at the caret (WebKit reads the caret
// through getComposedRanges).
const host = document.querySelector("#the-doc");
await host.load(`# T

See @tbl:a. Compare

::: table {#a}
caption: "First"
columns:
  - {name: k, type: text}
data:
  - [x]
:::

::: table {#b}
caption: "Second"
columns:
  - {name: k, type: text}
data:
  - [y]
:::
`);
await new Promise((r) => setTimeout(r, 300));
const root = host.shadowRoot;
const labels = [...root.querySelectorAll("figcaption[data-label]")].map(
  (f) => f.dataset.label,
);
const first = root.querySelector("a.folio-xref")?.textContent;
const p = root.querySelector("article > p");
const text = p.lastChild;
root.querySelector("article").focus();
document
  .getSelection()
  .setBaseAndExtent(text, text.data.length, text, text.data.length);
await new Promise((r) => setTimeout(r, 50));
const why = host.insertCrossRef("tbl:b");
await new Promise((r) => setTimeout(r, 100));
const md = host.getMarkdown();
return (
  "| captions numbered: " +
  (labels.join(",") === "Table 1,Table 2") +
  "\n| reference reads its number: " +
  (first === "Table 1") +
  "\n| inserting at the caret works: " +
  (why === null && md.includes("Compare @tbl:b"))
);
