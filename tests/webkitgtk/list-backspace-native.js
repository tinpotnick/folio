// native-key: BackSpace BackSpace
// Backspace at the START of a nested item lifts it a level; a second
// Backspace, now at the start of a top-level item, removes its bullet
// (a paragraph) - only after that do lines merge.
const host = document.querySelector("#the-doc");
await host.load("# T\n\n- one\n  - two\n- three\n");
await new Promise((r) => setTimeout(r, 150));
const root = host.shadowRoot;
const art = root.querySelector("article");
const two = art.querySelector("li li");
art.focus();
document.getSelection().setBaseAndExtent(two.firstChild, 0, two.firstChild, 0);
window.__folioCheck = () => {
  const a = root.querySelector("article");
  const kids = [...a.children].map((c) => c.tagName + ":" + c.textContent);
  return (
    "| two is a paragraph between the lists: " +
    (kids.join(",") === "H1:T,UL:one,P:two,UL:three")
  );
};
return "set";
