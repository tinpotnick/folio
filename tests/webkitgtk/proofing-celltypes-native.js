// Typed-column validation + digit tokens in the REAL desktop engine
// (WebKitGTK): numbers in prose and in valid typed cells get NO spell
// marks (a digit-bearing token is never a word), a text-column cell is
// still spell-checked, and typed cells whose value the column type
// rejects ("soon" in a number column, "tomorrow" in a date column) get
// a folio-invalid span. The model stays clean (marks are view spans).
const host = document.querySelector("#the-doc");
await host.load(
  '# T\n\nI have 3 dogs.\n\n::: table {#t}\ncaption: "T"\ncolumns:\n  - {name: note, type: text}\n  - {name: qty, type: number}\n  - {name: day, type: date}\ndata:\n  - [wordd, 42, 2026-11-17]\n  - [fine, soon, tomorrow]\n:::\n',
);
const root = host.shadowRoot;
const texts = (sel) =>
  [...root.querySelectorAll(sel)].map((s) => s.textContent);
let spell = [];
let invalid = [];
for (let i = 0; i < 40 && !(spell.length && invalid.length); i++) {
  await new Promise((r) => setTimeout(r, 250));
  spell = texts(".folio-misspelled");
  invalid = texts(".folio-invalid");
}
const doc = host.getDoc();
const modelClean =
  !JSON.stringify(doc).includes("folio-misspelled") &&
  !JSON.stringify(doc).includes("folio-invalid");
return (
  '| prose number ("3") is never spell-marked in WebKitGTK: ' +
  !spell.includes("3") +
  '\n| text-column cell is still spell-checked ("wordd" marked): ' +
  spell.includes("wordd") +
  "\n| valid typed cells (42, 2026-11-17) carry no spell or invalid mark: " +
  (!spell.some((t) => /\d/.test(t)) &&
    !invalid.includes("42") &&
    !invalid.includes("2026-11-17")) +
  "\n| invalid typed values get the folio-invalid underline: " +
  (invalid.includes("soon") && invalid.includes("tomorrow")) +
  "\n| model markdown carries no mark spans: " +
  modelClean
);
