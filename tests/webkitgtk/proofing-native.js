// Bundled spell check in the REAL desktop engine (WebKitGTK): a
// misspelled word gets a folio-misspelled mark in the visual editor,
// the Markdown model stays clean (marks are pure view spans), and the
// caret is preserved across the mark pass. (Standing order: caret-
// sensitive changes are verified in both engines - see AGENTS.md.)
const host = document.querySelector("#the-doc");
await host.load("# T\n\nI recieve letters often.\n");
const root = host.shadowRoot;
const p = root.querySelector("article p");
// put the caret mid-paragraph BEFORE the mark pass runs
const sel = document.getSelection();
const text = p.firstChild;
sel.setBaseAndExtent(text, 3, text, 3);
// wait for the lazy dictionary load + the debounced mark pass
let marked = null;
for (let i = 0; i < 40 && !marked; i++) {
  await new Promise((r) => setTimeout(r, 250));
  marked = root.querySelector(".folio-misspelled");
}
const rg = sel.getComposedRanges({ shadowRoots: [root] })[0];
// measure the caret as a text offset within the block (the mark pass
// rewraps text into spans, so the node/offset pair changes but the
// block-relative offset is the invariant)
let caretInP = false;
if (rg && p.contains(rg.startContainer)) {
  const r2 = document.createRange();
  r2.selectNodeContents(p);
  r2.setEnd(rg.startContainer, rg.startOffset);
  caretInP = r2.toString().length === 3;
}
const doc = host.getDoc();
const modelClean = !JSON.stringify(doc).includes("folio-misspelled");
return (
  "| misspelled word marked in WebKitGTK: " +
  !!(marked && marked.textContent === "recieve") +
  "\n| model markdown carries no mark span: " +
  modelClean +
  "\n| caret kept its place across the mark pass: " +
  caretInP
);
