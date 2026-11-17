// Crop drag HELD at the stage edge must auto-scroll the stage so the
// selection extends past the visible viewport (image wider than the
// article), and Apply must crop the full dragged region - not just
// what was visible. Synthetic mouse events; the auto-scroll is driven
// by a timer, so no real frames are needed.
const host = document.querySelector("#the-doc");
const wideB64 = await (async () => {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 60;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#3366cc";
  ctx.fillRect(0, 0, 1600, 60);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return "";
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
})();
await host.load(`# T\n\n![wide](data:image/png;base64,${wideB64})`);
await new Promise((r) => setTimeout(r, 300));
const root = host.shadowRoot;
const figure = root.querySelector("figure.folio-image");
const img = figure.querySelector("img");
figure.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
await new Promise((r) => setTimeout(r, 100));
const bar = figure.querySelector(".folio-inspector");
bar.querySelector(".insp-crop").click();
await new Promise((r) => setTimeout(r, 100));
const stage = figure.querySelector(".folio-crop-stage");
const ov = figure.querySelector(".folio-crop-overlay");
const sr = stage.getBoundingClientRect();
const ir = img.getBoundingClientRect();
const y0 = ir.top + ir.height * 0.1;
const y1 = ir.top + ir.height * 0.9;
ov.dispatchEvent(
  new MouseEvent("mousedown", {
    bubbles: true,
    clientX: sr.left + 40,
    clientY: y0,
  }),
);
document.dispatchEvent(
  new MouseEvent("mousemove", {
    bubbles: true,
    clientX: sr.right - 4,
    clientY: y1,
  }),
);
// hold the pointer at the right edge while the timer auto-scrolls
await new Promise((r) => setTimeout(r, 900));
const scrolled = stage.scrollLeft;
document.dispatchEvent(
  new MouseEvent("mouseup", {
    bubbles: true,
    clientX: sr.right - 4,
    clientY: y1,
  }),
);
await new Promise((r) => setTimeout(r, 100));
const rect = figure.querySelector(".folio-crop-rect");
const rectW = rect ? Number(rect.style.width.replace("px", "")) : 0;
bar.querySelector(".insp-apply").click();
await new Promise((r) => setTimeout(r, 800));
const img2 = root.querySelector("figure.folio-image img");
const nw = img2 ? img2.naturalWidth : 0;
return [
  "",
  `image wider than the stage (${Math.round(ir.width)}px vs ${Math.round(sr.width)}px): ` +
    (ir.width > sr.width + 200 ? "true" : "false"),
  `stage auto-scrolled on edge drag (scrollLeft=${Math.round(scrolled)}): ` +
    (scrolled > 50 ? "true" : "false"),
  `selection wider than the visible stage (${Math.round(rectW)}px > ${Math.round(sr.width)}px): ` +
    (rectW > sr.width ? "true" : "false"),
  `applied crop wider than the viewport, not the whole image (${nw}px of 1600): ` +
    (nw > sr.width && nw < 1600 ? "true" : "false"),
].join(" | ");
