// Citations in the desktop engine: a ```bibtex block becomes the
// reference list, citations read "(Knuth, 1984)", and inserting one at
// the caret works (WebKit reads the caret through getComposedRanges).
const host = document.querySelector("#the-doc");
await host.load(`# T

As argued [@knuth1984, p. 99]. Compare

## References

\`\`\`bibtex
@article{knuth1984,
  author = {Knuth, Donald E.}, title = {Literate Programming},
  journal = {The Computer Journal}, year = {1984}
}
@book{tufte1983,
  author = {Tufte, Edward R.},
  title = {The Visual Display of Quantitative Information},
  publisher = {Graphics Press}, year = {1983}
}
\`\`\`
`);
await new Promise((r) => setTimeout(r, 300));
const root = host.shadowRoot;
const first = root.querySelector("span.folio-cite")?.textContent;
const listed = root.querySelectorAll("ol.folio-refs li").length;
const p = root.querySelector("article > p");
const text = p.lastChild;
root.querySelector("article").focus();
document
  .getSelection()
  .setBaseAndExtent(text, text.data.length, text, text.data.length);
await new Promise((r) => setTimeout(r, 50));
const why = host.insertCitation("tufte1983");
await new Promise((r) => setTimeout(r, 100));
const md = host.getMarkdown();
const after = root.querySelectorAll("ol.folio-refs li").length;
return (
  "| citation reads author-date: " +
  (first === "(Knuth, 1984, p. 99)") +
  "\n| only cited entries listed: " +
  (listed === 1) +
  "\n| inserting at the caret works: " +
  (why === null && md.includes("Compare [@tufte1983]")) +
  "\n| the list follows: " +
  (after === 2)
);
