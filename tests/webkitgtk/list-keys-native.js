// native-key: o n e Return t w o Tab Return shift+ISO_Left_Tab
// The user's sequence with REAL keys in WebKitGTK: a bulleted list,
// "one", Enter, "two", Tab, Enter, Shift+Tab. The new item lands back
// at the top level, the toolbar's bullet button stays lit, and the
// caret is in that item.
const host = document.querySelector("#the-doc");
await host.load("# T\n\nIntro\n");
await new Promise((r) => setTimeout(r, 150));
const root = host.shadowRoot;
const art = root.querySelector("article");
const p = art.querySelector(":scope > p");
art.focus();
document.getSelection().setBaseAndExtent(p, 0, p, 0);
host.toggleList(false);
window.__folioCheck = () => {
  const a = root.querySelector("article");
  const top = [...a.querySelectorAll(":scope > ul > li")];
  const bullet = document.querySelector('#block-bar button[data-block="ul"]');
  const r = document
    .getSelection()
    .getComposedRanges({ shadowRoots: [root] })[0];
  return [
    "",
    "nested 'two' under 'one': " +
      (a.querySelector(":scope > ul > li > ul > li")?.textContent === "two"),
    "Shift+Tab lifts the new item to the top level: " + (top.length === 2),
    "bullet button is lit: " + bullet.classList.contains("active"),
    "caret in the lifted item: " + !!(r && top[1]?.contains(r.startContainer)),
  ].join(" | ");
};
return "set";
