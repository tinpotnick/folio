// native-key: End x y z Home a Return
// Editing a footnote in the desktop engine with REAL keys: End stays in
// the note (the browser's End jumped past the ↩ into the next note),
// typing writes back to the definition, Home goes to the note's start,
// and Enter does not split the note.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\nA[^one] and B[^two].\n\n[^one]: First.\n[^two]: Second.\n",
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const text = root.querySelector(
  'section.folio-notes li[data-fn="one"] .fn-text',
);
text.focus();
document
  .getSelection()
  .setBaseAndExtent(text.firstChild, 2, text.firstChild, 2);
window.__folioCheck = () => {
  const md = host.getMarkdown();
  return (
    "| End then typing lands at the end of the SAME note: " +
    md.includes("[^one]: aFirst.xyz") +
    "\n| the next note is untouched: " +
    md.includes("[^two]: Second.") +
    "\n| Enter did not split the note: " +
    (root.querySelectorAll("section.folio-notes li").length === 2)
  );
};
