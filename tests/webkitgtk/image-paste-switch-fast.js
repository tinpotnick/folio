// A pasted photo used to embed raw: multi-MB of base64 as one source
// line, and laying that line out made the Markdown view switch take
// many seconds on WebKitGTK. Now the paste downscales the image first,
// so the switch is fast and the page stays alive. (image-source-view.js
// covers the other path: an undecodable 8 MB blob still embeds raw, and
// the source view must survive that line.)
const host = document.querySelector("#the-doc");
await host.load("# T\n\nHello world.\n");
await new Promise((r) => setTimeout(r, 300));
const art = host.shadowRoot.querySelector("article");
art.focus();
// a realistic multi-MB photo: 4000x3000 gradient+noise as JPEG
const b64 = await (async () => {
  const c = document.createElement("canvas");
  c.width = 4000;
  c.height = 3000;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(4000, 3000);
  const d = img.data;
  for (let y = 0; y < 3000; y++) {
    for (let x = 0; x < 4000; x++) {
      const i = (y * 4000 + x) * 4;
      d[i] = (x / 16 + ((x * y) % 97)) % 256;
      d[i + 1] = (y / 12 + ((x ^ y) % 89)) % 256;
      d[i + 2] = ((x + y) % 211) % 256;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
  if (!blob) return "";
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
})();
const bin = atob(b64);
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
const dt = new DataTransfer();
dt.items.add(new File([bytes], "big-photo.jpg", { type: "image/jpeg" }));
art.dispatchEvent(
  new ClipboardEvent("paste", {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  }),
);
await new Promise((r) => setTimeout(r, 1500));
const img = host
  .getDoc()
  .blocks.find(
    (b) => b.kind === "image" && b.image.src.startsWith("data:image/"),
  );
const srcLen = img ? img.image.src.length : -1;
const t0 = Date.now();
document.querySelector("#btn-markdown").click();
const switchMs = Date.now() - t0;
await new Promise((r) => setTimeout(r, 2000));
const mdLen = document.querySelector("#editor").value.length;
return [
  "",
  "photo pasted: " + (img ? "true" : "false"),
  "embedded shrunk (<1.5M chars): " +
    (srcLen > 0 && srcLen < 1_500_000 ? "true" : "false"),
  "markdown view shown: " +
    (!document.querySelector("#md-wrap").hidden ? "true" : "false"),
  `switch under 5s (${switchMs}ms): ` + (switchMs < 5000 ? "true" : "false"),
  `source is small (${mdLen} chars): ` + (mdLen < 1_600_000 ? "true" : "false"),
  "page alive: true",
].join(" | ");
