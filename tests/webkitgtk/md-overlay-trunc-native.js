// native-key: x
// A huge line WITHOUT a data URI must render TRUNCATED in the source-view
// overlay (bounded layout/paint on GPU-composited WebKitGTK), expand when
// the caret enters the line, and the editor must accept a REAL key
// immediately after the switch.
// (spec: docs/specs/section-browser-and-highlighting.md)
const host = document.querySelector("#the-doc");
await host.load(`# T\n\n${"B".repeat(2000)}\n\ntext\n`);
const btnMd = document.querySelector("#btn-markdown");
btnMd.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }),
);
await new Promise((r) => setTimeout(r, 300));
const ed = document.querySelector("#editor");
const len0 = ed.value.length;
// Caret at the top: the blob line must render truncated.
ed.focus();
ed.setSelectionRange(0, 0);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const view = document.querySelector("#md-view");
const rows = Array.from(view.querySelectorAll(".ln"));
const blobRow = rows.find((r) => /^B/.test(r.textContent ?? ""));
const probe = {
  len0,
  blobLen: (blobRow?.textContent ?? "").length,
  hasMarker: !!blobRow?.querySelector(".tk-trunc"),
  hasChip: !!blobRow?.querySelector(".tk-data"),
};
// Caret into the blob line: the overlay row must expand to full text.
const pos = ed.value.indexOf("B") + 10;
ed.setSelectionRange(pos, pos);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const rows2 = Array.from(
  document.querySelector("#md-view").querySelectorAll(".ln"),
);
const blobRow2 = rows2.find((r) => /^B/.test(r.textContent ?? ""));
probe.expandedLen = (blobRow2?.textContent ?? "").length;
probe.expandedMarker = !!blobRow2?.querySelector(".tk-trunc");
// Caret back to the top (where the REAL key will land).
ed.setSelectionRange(0, 0);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
window.__probe = probe;
window.__folioCheck = () => {
  const v = document.querySelector("#editor").value;
  return [
    "",
    "blob line overlay row truncated to a bounded prefix: " +
      (window.__probe.blobLen > 0 && window.__probe.blobLen < 1100),
    "truncation marker rendered (no chip on a non-data line): " +
      (window.__probe.hasMarker && !window.__probe.hasChip),
    "caret in the line expands the overlay row in full: " +
      (window.__probe.expandedLen > 1500 && !window.__probe.expandedMarker),
    "REAL key x landed in the editor right after the switch: " +
      (v.length === window.__probe.len0 + 1 && v.startsWith("x")),
  ].join(" | ");
};
return "set";
