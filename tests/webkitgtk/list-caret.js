// The user's steps on the welcome page, in WebKitGTK: Enter after a
// paragraph, the bullet button, two more items, Tab. (JS cannot send
// a trusted Enter, so the new paragraph / items are made the way the
// engine makes them; the bullet and Tab go through folio itself.)
const host = document.querySelector("#the-doc");
const root = host.shadowRoot;
let art = root.querySelector("article");
const sel = document.getSelection();
const put = (n, o) => sel.setBaseAndExtent(n, o, n, o);
const tick = () => new Promise((r) => setTimeout(r, 50));
const log = [];
const p = art.querySelectorAll(":scope > p")[1];
art.focus();
put(p, p.childNodes.length);
const np = document.createElement("p");
np.appendChild(document.createElement("br"));
p.after(np);
put(np, 0);
art.dispatchEvent(new InputEvent("input", { bubbles: true }));
await tick();
host.toggleList(false);
await tick();
art = root.querySelector("article");
const list = art.querySelector(":scope > ul[data-block-index='3']");
log.push("bullet lands on the NEW line: " + !!list);
{
  // Focus survives the bullet: the caret is IN the new list item.
  const r = sel.getComposedRanges({ shadowRoots: [root] })[0];
  log.push(
    "bullet keeps the caret in the list: " +
      !!(r && list?.contains(r.startContainer) && root.activeElement === art),
  );
}
if (!list) return log.join(" | ");
const li1 = list.querySelector("li");
li1.textContent = "one";
const li2 = document.createElement("li");
li2.textContent = "two";
const li3 = document.createElement("li");
li3.textContent = "three";
list.append(li2, li3);
art.dispatchEvent(new InputEvent("input", { bubbles: true }));
await tick();
put(li3.firstChild, 5);
const ev = new KeyboardEvent("keydown", {
  key: "Tab",
  bubbles: true,
  cancelable: true,
  composed: true,
});
art.dispatchEvent(ev);
await tick();
log.push("Tab nests the item: " + (li3.parentElement?.parentElement === li2));
log.push("Tab is handled: " + ev.defaultPrevented);
const r = sel.getComposedRanges({ shadowRoots: [root] })[0];
log.push("caret stays in the item: " + !!(r && li3.contains(r.startContainer)));
const back = new KeyboardEvent("keydown", {
  key: "Tab",
  shiftKey: true,
  bubbles: true,
  cancelable: true,
  composed: true,
});
art.dispatchEvent(back);
await tick();
log.push("Shift+Tab lifts it back: " + (li3.parentElement === list));
return log.join(" | ");
