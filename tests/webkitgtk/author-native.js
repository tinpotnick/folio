// native-key: s a m Return
// The comment author name is set natively (spec: docs/specs/comments.md,
// "Setting the author"): clicking the author button on a comment opens
// the author dialog prefilled with that comment's author (no profile
// name stored here), real keys type a new name, and Return (form
// submit) saves - the name lands in localStorage, the existing comment
// is renamed, and the next comment is stamped with it.
const host = document.querySelector("#the-doc");
localStorage.removeItem("folio-comment-author");
await host.load(
  "# T\n\nText.\n\n::: comment {#c-1}\nauthor: nick\nA note.\n:::\n",
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const authorBtn = root.querySelector(
  "aside.folio-comment .folio-comment-author",
);
authorBtn.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true }),
);
await new Promise((r) => setTimeout(r, 150));
// Captured now: the native keys below open-and-close the dialog before
// __folioCheck runs.
window.__folioOpened = document.querySelector("#author-modal")?.open === true;
window.__folioPrefill = document.querySelector("#author-input")?.value;
window.__folioCheck = () => {
  const modal = document.querySelector("#author-modal");
  const p = root.querySelector("article > p");
  document.getSelection().setBaseAndExtent(p, 0, p, 1);
  const why = host.insertComment(
    localStorage.getItem("folio-comment-author") ?? "",
  );
  const comments = host
    .getDoc()
    .blocks.filter((b) => b.kind === "comment")
    .map((b) => (b.kind === "comment" ? b.comment.author : ""));
  const renamed = root.querySelector(
    "aside.folio-comment .folio-comment-author",
  );
  return [
    "",
    "clicking the author name opened the dialog: " +
      (window.__folioOpened ? "true" : "false"),
    "dialog prefilled with the clicked comment's author: " +
      (window.__folioPrefill === "nick" ? "true" : "false"),
    "Return saved the typed name to localStorage: " +
      (localStorage.getItem("folio-comment-author") === "sam"
        ? "true"
        : "false"),
    "dialog closed after save: " + (modal && !modal.open ? "true" : "false"),
    "existing comment renamed in the view: " +
      (renamed && renamed.textContent === "sam" ? "true" : "false"),
    "existing comment renamed in the model: " +
      (comments[0] === "sam" ? "true" : "false"),
    "a new comment is stamped with it: " +
      (comments[1] === "sam" ? "true" : "false"),
    "insert reported no problem: " + (why === null ? "true" : `false (${why})`),
  ].join(" | ");
};
return "set";
