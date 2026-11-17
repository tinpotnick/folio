// Crop selection handles in the REAL engine: draw a selection, grab
// the SE corner handle and drag it out (rect grows), grab the centre
// handle and drag (rect moves, same size), Apply crops the handled
// region. Synthetic mouse events; rect geometry is read from styles.
const host = document.querySelector("#the-doc");
const quadB64 = await (async () => {
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 100;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#3366cc";
  ctx.fillRect(0, 0, 200, 100);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return "";
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
})();
await host.load(`# T\n\n![q](data:image/png;base64,${quadB64})`);
await new Promise((r) => setTimeout(r, 300));
const root = host.shadowRoot;
const figure = root.querySelector("figure.folio-image");
const img = figure.querySelector("img");
figure.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
await new Promise((r) => setTimeout(r, 100));
const bar = figure.querySelector(".folio-inspector");
bar.querySelector(".insp-crop").click();
await new Promise((r) => setTimeout(r, 100));
const ov = figure.querySelector(".folio-crop-overlay");
const ir = img.getBoundingClientRect();
const rect = figure.querySelector(".folio-crop-rect");
const px = (v) => Number(v.replace("px", ""));
const drag = (target, x1, y1, x2, y2) => {
  target.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, clientX: x1, clientY: y1 }),
  );
  document.dispatchEvent(
    new MouseEvent("mousemove", { bubbles: true, clientX: x2, clientY: y2 }),
  );
  document.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, clientX: x2, clientY: y2 }),
  );
};
// draw 0.2..0.6
drag(
  ov,
  ir.left + ir.width * 0.2,
  ir.top + ir.height * 0.2,
  ir.left + ir.width * 0.6,
  ir.top + ir.height * 0.6,
);
await new Promise((r) => setTimeout(r, 100));
const w1 = px(rect.style.width);
const h1 = px(rect.style.height);
const handles = rect.querySelectorAll(".folio-crop-handle");
// SE corner handle: drag out to 0.9
const se = rect.querySelector(".folio-crop-h-se");
const sr = se.getBoundingClientRect();
drag(
  se,
  sr.left + sr.width / 2,
  sr.top + sr.height / 2,
  ir.left + ir.width * 0.9,
  ir.top + ir.height * 0.9,
);
await new Promise((r) => setTimeout(r, 100));
const w2 = px(rect.style.width);
const h2 = px(rect.style.height);
// centre handle: drag left/up 30x20px
const mv = rect.querySelector(".folio-crop-h-move");
const mr = mv.getBoundingClientRect();
const leftBefore = px(rect.style.left);
const topBefore = px(rect.style.top);
drag(
  mv,
  mr.left + mr.width / 2,
  mr.top + mr.height / 2,
  mr.left - 30,
  mr.top - 20,
);
await new Promise((r) => setTimeout(r, 100));
const leftAfter = px(rect.style.left);
const w3 = px(rect.style.width);
bar.querySelector(".insp-apply").click();
await new Promise((r) => setTimeout(r, 800));
const img2 = root.querySelector("figure.folio-image img");
const nw = img2 ? img2.naturalWidth : 0;
return [
  "",
  `five handles on the selection (${handles.length}): ` +
    (handles.length === 5 ? "true" : "false"),
  `SE handle resized the rect (${Math.round(w1)}x${Math.round(h1)} -> ${Math.round(w2)}x${Math.round(h2)}): ` +
    (w2 > w1 + 20 && h2 > h1 + 20 ? "true" : "false"),
  `centre handle moved the rect (left ${Math.round(leftBefore)} -> ${Math.round(leftAfter)}): ` +
    (leftAfter < leftBefore - 10 && Math.abs(w3 - w2) < 2 ? "true" : "false"),
  `applied crop smaller than the image but a real region (${nw}px of 200): ` +
    (nw > 60 && nw < 200 ? "true" : "false"),
  "bar wraps in crop mode: " +
    (bar.classList.contains("cropping") ? "true" : "false"),
].join(" | ");
