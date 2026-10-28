// The help panel in the desktop engine: it docks beside the document
// with its head in view, lists the topics, and opens one at its top
// (the old help modal scrolled its own header away on a jump).
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const panel = document.querySelector("#help-panel");
if (!panel.hidden) document.querySelector("#btn-help-close").click();
document.querySelector("#btn-help").click();
const help = document.querySelector("#help-doc");
for (let i = 0; i < 40 && !help.shadowRoot?.querySelector("article h1"); i++) {
  await wait(50);
}
const h1 = () => help.shadowRoot.querySelector("article h1")?.textContent ?? "";
const listed = h1() === "folio help";
const link = [...help.shadowRoot.querySelectorAll("article a")].find(
  (a) => a.textContent === "Charts",
);
link?.click();
for (let i = 0; i < 40 && h1() !== "Charts"; i++) await wait(50);
const topic = h1() === "Charts";
const close = document.querySelector("#btn-help-close").getBoundingClientRect();
const head = document.querySelector("header").getBoundingClientRect();
const headInView = close.top >= head.bottom - 1 && close.bottom <= innerHeight;
const r = panel.getBoundingClientRect();
const doc = document.querySelector("#the-doc").getBoundingClientRect();
const beside =
  innerWidth > 1000 ? doc.right <= r.left + 1 : r.right <= innerWidth + 1;
document.querySelector("#btn-help-close").click();
return (
  "| the topic list shows: " +
  listed +
  " | a topic opens in the panel: " +
  topic +
  " | the panel head is in view: " +
  headInView +
  " | beside the document: " +
  beside +
  " | it closes: " +
  panel.hidden
);
