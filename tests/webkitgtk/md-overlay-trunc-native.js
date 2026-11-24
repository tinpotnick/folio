// native-key: x
// Huge data-URI lines must render TRUNCATED in the source-view overlay
// (bounded layout/paint on GPU-composited WebKitGTK - the un-truncated
// overlay left the editor uneditable for ~20s after a view switch),
// expand when the caret enters the line, and the editor must accept a
// REAL key immediately after the switch.
// (spec: docs/specs/section-browser-and-highlighting.md)
const B64 = "A".repeat(1500);
const host = document.querySelector("#the-doc");
await host.load(
  `::: audio {#a1}\nsrc: data:audio/wav;base64,${B64}\n:::\n\n# T\n\ntext\n`,
);
const btnMd = document.querySelector("#btn-markdown");
btnMd.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }),
);
await new Promise((r) => setTimeout(r, 300));
const ed = document.querySelector("#editor");
const len0 = ed.value.length;
// Caret at the top: the src line must render truncated.
ed.focus();
ed.setSelectionRange(0, 0);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const view = document.querySelector("#md-view");
const rows = Array.from(view.querySelectorAll(".ln"));
const srcRow = rows.find((r) => (r.textContent ?? "").includes("base64,"));
const probe = {
  len0,
  srcRowLen: (srcRow?.textContent ?? "").length,
  hasMarker: !!srcRow?.querySelector(".tk-trunc"),
  rowCount: rows.length,
};
// Caret into the src line: the overlay row must expand to full text.
const pos = ed.value.indexOf("base64,") + 10;
ed.setSelectionRange(pos, pos);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const rows2 = Array.from(
  document.querySelector("#md-view").querySelectorAll(".ln"),
);
const srcRow2 = rows2.find((r) => (r.textContent ?? "").includes("base64,"));
probe.expandedLen = (srcRow2?.textContent ?? "").length;
probe.expandedMarker = !!srcRow2?.querySelector(".tk-trunc");
// Caret back to the top (where the REAL key will land).
ed.setSelectionRange(0, 0);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
window.__probe = probe;
window.__folioCheck = () => {
  const v = document.querySelector("#editor").value;
  return [
    "",
    "src line overlay row truncated to a bounded prefix: " +
      (window.__probe.srcRowLen > 0 && window.__probe.srcRowLen < 1100),
    "truncation marker rendered: " + window.__probe.hasMarker,
    "caret in the line expands the overlay row in full: " +
      (window.__probe.expandedLen > 1500 && !window.__probe.expandedMarker),
    "REAL key x landed in the editor right after the switch: " +
      (v.length === window.__probe.len0 + 1 && v.startsWith("x")),
  ].join(" | ");
};
return "set";
