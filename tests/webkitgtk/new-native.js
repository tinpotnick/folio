// native-key: ctrl+n
// A REAL Ctrl+N opens a new, blank document in the desktop app, with
// the caret waiting in its title.
document.body.focus();
window.__folioCheck = () => {
  const root = document.querySelector("#the-doc").shadowRoot;
  const h1 = root.querySelector("article > h1");
  const blank =
    !!h1 &&
    h1.textContent === "" &&
    root.querySelector("article").children.length === 1;
  const sel = document.getSelection();
  const r = sel.getComposedRanges
    ? sel.getComposedRanges({ shadowRoots: [root] })[0]
    : null;
  const inTitle =
    !!r && (r.startContainer === h1 || h1.contains(r.startContainer));
  return (
    "| real Ctrl+N opens a blank document: " +
    blank +
    "\n| the caret is in its title: " +
    inTitle
  );
};
