// Bundled GRAMMAR check in the REAL desktop engine (WebKitGTK): enable
// it on an already-open document (the palette flow), the Harper WASM
// loads and a hit ("I has a dog.") gets a folio-grammar span - and the
// mark SURVIVES a second mark pass. Regression: unwrapping a mark splits
// the text node; without host.normalize() after the unwrap, the re-wrap
// failed its same-text-node check and the mark silently vanished on
// every pass after the first (the user saw nothing). Model stays clean.
const host = document.querySelector("#the-doc");
const markOnHas = () => {
  const spans = [...host.shadowRoot.querySelectorAll(".folio-grammar")];
  return spans.some((s) => s.textContent === "has");
};
await host.load("# T\n\nI has a dog.\n");
await new Promise((r) => setTimeout(r, 500));
// the palette command's action: enable, then schedule a mark pass
host.setGrammar(true);
// pre-warm the engine so the mark assertion is not racing the (slow,
// cold-cache) 20 MB wasm load
const m = await import("/src/spell/grammar.js");
await m.getLinter();
let ok1 = false;
for (let i = 0; i < 40 && !ok1; i++) {
  await new Promise((r) => setTimeout(r, 500));
  ok1 = markOnHas();
}
// force a second pass (grammar off -> on): unwrap + re-wrap
host.setGrammar(false);
await new Promise((r) => setTimeout(r, 900));
host.setGrammar(true);
let ok2 = false;
for (let i = 0; i < 40 && !ok2; i++) {
  await new Promise((r) => setTimeout(r, 500));
  ok2 = markOnHas();
}
const modelClean = !JSON.stringify(host.getDoc()).includes("folio-grammar");
return (
  '| grammar mark on "has" appears in WebKitGTK after enabling post-load: ' +
  ok1 +
  "\n| mark survives a second mark pass (re-wrap after unwrap): " +
  ok2 +
  "\n| model markdown carries no mark span: " +
  modelClean
);
