// A pasted photo embeds as a data: URL inside an image directive - a
// multi-megabyte single line in the markdown source. Switching to the
// source view must not lock the engine: the spell pass skips that line
// whole (it is not prose). Before the token cap, every base64 "word"
// got spell-checked and wrapped - tens of thousands of mark spans pegged
// the WebKitGTK web process for minutes (the suite's 120s timeout fired).
const host = document.querySelector("#the-doc");
await host.load("# T\n\nHello world.\n");
await new Promise((r) => setTimeout(r, 300));
const art = host.shadowRoot.querySelector("article");
art.focus();
const bytes = new Uint8Array(8_000_000);
for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
const dt = new DataTransfer();
dt.items.add(new File([bytes], "photo.png", { type: "image/png" }));
art.dispatchEvent(
  new ClipboardEvent("paste", {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  }),
);
await new Promise((r) => setTimeout(r, 1500));
document.querySelector("#btn-markdown").click();
await new Promise((r) => setTimeout(r, 2500));
const img = host
  .getDoc()
  .blocks.find(
    (b) =>
      b.kind === "image" && b.image.src.startsWith("data:image/png;base64,"),
  );
const mdWrap = document.querySelector("#md-wrap");
const ln = [...document.querySelectorAll("#md-view .ln")].find((l) =>
  l.querySelector(".tk-data"),
);
const marks = ln ? ln.querySelectorAll(".folio-misspelled").length : -1;
return [
  "",
  "image pasted as data url: " + (img ? "true" : "false"),
  "markdown view shown: " + (!mdWrap.hidden ? "true" : "false"),
  "source holds the image line: " +
    (document.querySelector("#editor").value.includes("data:image/png;base64,")
      ? "true"
      : "false"),
  "image line renders as a data chip, no spell marks on it: " +
    (ln !== undefined && marks === 0 ? "true" : "false"),
  // reaching this line at all means the engine never locked up
  "page alive: true",
].join(" | ");
