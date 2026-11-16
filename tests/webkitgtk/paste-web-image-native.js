// Pasting an image copied from a WEB PAGE on WebKitGTK: the clipboard
// carries text/html with an <img src> (no file data, no plain text).
// The image must land in the model as an image block with that src -
// before, the paste was swallowed and nothing appeared.
const host = document.querySelector("#the-doc");
await host.load("# T\n\nHello world.\n");
await new Promise((r) => setTimeout(r, 400));
const root = host.shadowRoot;
const art = root.querySelector("article");
art.focus();
const dt = new DataTransfer();
dt.setData("text/html", '<img src="https://example.com/pic.png" alt="A pic">');
const ev = new ClipboardEvent("paste", {
  clipboardData: dt,
  bubbles: true,
  cancelable: true,
});
art.dispatchEvent(ev);
await new Promise((r) => setTimeout(r, 500));
const doc = host.getDoc();
const img = doc.blocks.find((b) => b.kind === "image");
return (
  "| web-image paste landed as an image block: " +
  !!img +
  "\n| src kept: " +
  !!(img && img.image && img.image.src === "https://example.com/pic.png") +
  "\n| alt from the img tag: " +
  !!(img && img.image && img.image.alt === "A pic")
);
