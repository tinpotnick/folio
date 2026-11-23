// The general context menu in the real engine (WebKitGTK): a
// contextmenu event in the document opens folio's menu (never the
// webview's own), and its "Add comment" lands a comment aside
// (spec: docs/specs/context-menu.md). The host hook is what the
// desktop wires to the author name.
const host = document.querySelector("#the-doc");
await host.load("# T\n\nSome words to click on.\n");
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const p = root.querySelector("article > p");
document.getSelection().setBaseAndExtent(p, 0, p, 0);
let commentRan = false;
host.onRequestComment = () => {
  commentRan = true;
  host.insertComment("nick");
};
p.dispatchEvent(
  new MouseEvent("contextmenu", {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: 120,
    clientY: 120,
  }),
);
await new Promise((r) => setTimeout(r, 200));
const menu = root.querySelector(".folio-doc-menu");
const labels = menu
  ? [...menu.querySelectorAll("button .mi-label")].map((b) => b.textContent)
  : [];
const addBtn = menu
  ? [...menu.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Add comment"),
    )
  : null;
if (addBtn) addBtn.click();
await new Promise((r) => setTimeout(r, 300));
const aside = root.querySelector("aside.folio-comment");
return `| menu opened: ${!!menu} | has Cut/Copy/Paste/Select all/Add comment: ${["Cut", "Copy", "Paste", "Select all", "Add comment"].every((l) => labels.includes(l))} | comment action ran: ${commentRan} | aside rendered: ${!!aside} | menu closed after pick: ${!root.querySelector(".folio-doc-menu")}`;
