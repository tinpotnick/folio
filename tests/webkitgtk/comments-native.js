// Comments in the real engine (WebKitGTK): a selection quotes and
// anchors a comment. There is no shadowRoot.getSelection here and
// addRange drops shadow nodes, so the selection is set with
// setBaseAndExtent and insertComment reads it through the document's
// composed ranges (spec: docs/specs/comments.md).
const host = document.querySelector("#the-doc");
await host.load("# T\n\nGrowth was strongest in the Midlands.\n");
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const p = root.querySelector("article > p");
document.getSelection().setBaseAndExtent(p, 0, p, 1);
await new Promise((r) => setTimeout(r, 100));
const want = "Growth was strongest in the Midlands.";
const why = host.insertComment("nick");
await new Promise((r) => setTimeout(r, 300));
const aside = root.querySelector("aside.folio-comment");
const quote = aside
  ? (aside.querySelector(".folio-comment-quote")?.textContent ?? "")
  : "";
const mark = root.querySelector("mark.folio-comment-mark");
return `| insert ok: ${why === null} | aside rendered: ${!!aside} | quote from selection: ${quote === want} | quote marked in prose: ${!!mark && mark.textContent === quote}`;
