// The toolbar's menus in the desktop engine: the style menu opens on
// screen (position: fixed, not clipped by the bar's overflow-x: clip),
// a pick restyles the caret's block, and the bar fits its window.
const host = document.querySelector("#the-doc");
await host.load("# T\n\nPick me.\n");
await new Promise((r) => setTimeout(r, 150));
const root = host.shadowRoot;
const art = root.querySelector("article");
const p = art.querySelector("p");
art.focus();
document.getSelection().setBaseAndExtent(p.firstChild, 2, p.firstChild, 2);
await new Promise((r) => setTimeout(r, 100));
const press = (el) => {
  el.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
};
press(document.querySelector("#btn-style-menu"));
await new Promise((r) => setTimeout(r, 100));
const menu = document.querySelector("#style-menu");
const r = menu.getBoundingClientRect();
const onScreen =
  !menu.hidden && r.width > 100 && r.left >= 0 && r.right <= window.innerWidth;
press(menu.querySelector('button[data-block="h2"]'));
await new Promise((r) => setTimeout(r, 150));
const h2 =
  !!root.querySelector("article h2") &&
  root.querySelector("article h2").textContent === "Pick me.";
const bar = document.querySelector("header .toolbar");
return (
  "| the style menu opens on screen: " +
  onScreen +
  "\n| a pick sets the block: " +
  h2 +
  "\n| the menu closes: " +
  menu.hidden +
  "\n| the bar fits its window: " +
  (bar.scrollWidth <= bar.clientWidth)
);
