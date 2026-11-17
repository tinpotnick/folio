// The image inspector's crop tool in the REAL engine: build a
// quadrant image, open crop mode, drag a selection over the top-left
// quadrant with synthetic mouse events, apply - the img must be
// re-encoded to just that region (80x40 of 200x100) as a data URI.
const host = document.querySelector("#the-doc");
const quadB64 = await (async () => {
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 100;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, 100, 50);
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(100, 0, 100, 50);
  ctx.fillStyle = "#0000ff";
  ctx.fillRect(0, 50, 100, 50);
  ctx.fillStyle = "#ffff00";
  ctx.fillRect(100, 50, 100, 50);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return "";
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
})();
await host.load(`# T\n\n![quads](data:image/png;base64,${quadB64})`);
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
const x1 = ir.left + ir.width * 0.1;
const y1 = ir.top + ir.height * 0.1;
const x2 = ir.left + ir.width * 0.5;
const y2 = ir.top + ir.height * 0.5;
ov.dispatchEvent(
  new MouseEvent("mousedown", { bubbles: true, clientX: x1, clientY: y1 }),
);
document.dispatchEvent(
  new MouseEvent("mousemove", { bubbles: true, clientX: x2, clientY: y2 }),
);
document.dispatchEvent(
  new MouseEvent("mouseup", { bubbles: true, clientX: x2, clientY: y2 }),
);
await new Promise((r) => setTimeout(r, 100));
const rect = figure.querySelector(".folio-crop-rect");
const rectVisible =
  rect &&
  rect.style.display !== "none" &&
  Number(rect.style.width.replace("px", "")) > 0;
bar.querySelector(".insp-apply").click();
await new Promise((r) => setTimeout(r, 800));
const img2 = host.shadowRoot.querySelector("figure.folio-image img");
const block = host.getDoc().blocks.find((b) => b.kind === "image");
return [
  "",
  "crop overlay shown: " + (!!ov ? "true" : "false"),
  "selection rect drawn: " + (rectVisible ? "true" : "false"),
  `cropped to 80x40 (${img2 ? img2.naturalWidth + "x" + img2.naturalHeight : "?"}): ` +
    (img2 && img2.naturalWidth === 80 && img2.naturalHeight === 40
      ? "true"
      : "false"),
  "src is a fresh data URI: " +
    (!!block && /^data:image\//.test(block.image.src) ? "true" : "false"),
  "crop mode exited: " +
    (!host.shadowRoot.querySelector(".folio-crop-overlay") ? "true" : "false"),
].join(" | ");
