// Clicking mid-text in a table column header (and in a data cell)
// must put the caret at the click position. WebKitGTK's
// document.caretRangeFromPoint does NOT pierce the shadow root (it
// returns the host), so the component scans the text boundaries for
// the nearest one instead - otherwise every click landed at offset 0.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\n::: table {#t}\ncolumns:\n  - {name: region, type: text}\n  - {name: b, type: number}\ndata:\n  - [one, 1]\n  - [two, 2]\n:::\n",
);
await new Promise((r) => setTimeout(r, 400));
const root = host.shadowRoot;
const tick = () => new Promise((r) => setTimeout(r, 150));
const caret = () => {
  const sel = document.getSelection();
  const rg = sel.getComposedRanges({ shadowRoots: [root] })[0];
  const n = rg?.startContainer;
  const el = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
  return { off: rg ? rg.startOffset : -1, el };
};

// 1) click the middle of the header name "region" (6 chars)
const name = root.querySelector('thead th[data-col-index="0"] span.name');
const nr = name.getBoundingClientRect();
name.dispatchEvent(
  new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    clientX: nr.left + nr.width / 2,
    clientY: nr.top + nr.height / 2,
    button: 0,
  }),
);
await tick();
const h = caret();
const headerOk =
  !!h.el && (h.el === name || name.contains(h.el)) && h.off > 0 && h.off < 6;

// 2) click the middle of a data cell ("one", 3 chars)
const td = root.querySelector('td[data-row-index="0"][data-col-index="0"]');
const tr = td.getBoundingClientRect();
td.dispatchEvent(
  new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    clientX: tr.left + tr.width / 2,
    clientY: tr.top + tr.height / 2,
    button: 0,
  }),
);
td.dispatchEvent(
  new MouseEvent("mouseup", {
    bubbles: true,
    cancelable: true,
    clientX: tr.left + tr.width / 2,
    clientY: tr.top + tr.height / 2,
    button: 0,
  }),
);
await tick();
const c = caret();
const cellOk = !!c.el && td.contains(c.el) && c.off > 0;

// 3) click past the right end of the header name: caret at the END
const tr2 = root
  .querySelector('thead th[data-col-index="0"]')
  .getBoundingClientRect();
root.querySelector('thead th[data-col-index="0"]').dispatchEvent(
  new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    clientX: tr2.right - 2,
    clientY: tr2.top + tr2.height / 2,
    button: 0,
  }),
);
await tick();
const e = caret();
const endOk = !!e.el && (e.el === name || name.contains(e.el)) && e.off === 6;

return (
  "| header mid-click caret in name at 0<off<6: " +
  headerOk +
  "\n| cell mid-click caret at off>0: " +
  cellOk +
  "\n| header past-end click caret at end (off=6): " +
  endOk
);
