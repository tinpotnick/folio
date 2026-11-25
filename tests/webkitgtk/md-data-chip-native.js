// native-key: x
// A long base64 data URI renders as a compact CHIP in the source-view
// overlay (mime + size, not a multi-KB text run): in a plain text editor
// you see the whole string; in folio it is a chip. The caret's line
// expands to the raw URI for editing, and the editor must accept a REAL
// key immediately after the switch.
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
// Caret at the top: the src line must render as a chip.
ed.focus();
ed.setSelectionRange(0, 0);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const view = document.querySelector("#md-view");
const rows = Array.from(view.querySelectorAll(".ln"));
const srcRow = rows.find((r) => (r.textContent ?? "").includes("base64"));
const chip = srcRow?.querySelector(".tk-data");
const probe = {
  len0,
  srcRowLen: (srcRow?.textContent ?? "").length,
  chipText: chip?.textContent ?? "",
  noTruncMarker: !srcRow?.querySelector(".tk-trunc"),
  rowCount: rows.length,
  overlayChars: (view.textContent ?? "").length,
};
// Caret into the src line: the overlay row must expand to the raw URI.
const pos = ed.value.indexOf("base64,") + 10;
ed.setSelectionRange(pos, pos);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const rows2 = Array.from(
  document.querySelector("#md-view").querySelectorAll(".ln"),
);
const srcRow2 = rows2.find((r) => (r.textContent ?? "").includes("base64,"));
probe.expandedLen = (srcRow2?.textContent ?? "").length;
probe.expandedChip = !!srcRow2?.querySelector(".tk-data");
// Caret back to the top (where the REAL key will land).
ed.setSelectionRange(0, 0);
ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
window.__probe = probe;
window.__folioCheck = () => {
  const v = document.querySelector("#editor").value;
  return [
    "",
    "data-URI line renders as a chip (bounded row): " +
      (window.__probe.srcRowLen > 0 && window.__probe.srcRowLen < 100),
    "chip label is mime + size: " +
      /^data:audio\/wav;base64 \[\d+(\.\d+)? kB\]$/.test(
        window.__probe.chipText,
      ) && window.__probe.noTruncMarker,
    "caret in the line expands the raw URI: " +
      (window.__probe.expandedLen > 1500 && !window.__probe.expandedChip),
    "textarea still holds the full URI (round-trip): " +
      v.includes("A".repeat(1500)),
    "REAL key x landed in the editor right after the switch: " +
      (v.length === window.__probe.len0 + 1 && v.startsWith("x")),
  ].join(" | ");
};
return "set";
