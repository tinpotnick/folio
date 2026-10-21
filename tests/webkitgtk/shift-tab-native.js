// native-key: shift+ISO_Left_Tab
// A REAL Shift+Tab in a nested item lifts it. WebKitGTK names this key
// "Unidentified" (only `code` is "Tab"); a key-only check left
// Shift+Tab dead in the desktop app while synthetic tests passed.
const host = document.querySelector("#the-doc");
await host.load("# T\n\n- one\n  - two\n- three\n");
await new Promise((r) => setTimeout(r, 100));
const root = host.shadowRoot;
const art = root.querySelector("article");
const two = root.querySelector("article li li");
art.focus();
const t = two.firstChild;
document.getSelection().setBaseAndExtent(t, 1, t, 1);
window.__folioCheck = () => {
  const top = [...root.querySelectorAll("article > ul > li")].map((li) =>
    li.firstChild.textContent.trim(),
  );
  return (
    "| real Shift+Tab lifts the item: " + (top.join(",") === "one,two,three")
  );
};
return "set";
