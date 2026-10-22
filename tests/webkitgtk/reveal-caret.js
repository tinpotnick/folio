// A section jump puts the caret at the start of its heading, so the
// toolbar shows H2 and typing continues there. WebKit ignores
// addRange() inside a shadow root; this goes through setCaret.
const host = document.querySelector("#the-doc");
await host.load("# T\n\nIntro.\n\n## Second\n\nMore.\n");
await new Promise((r) => setTimeout(r, 100));
const root = host.shadowRoot;
host.revealBlock(2);
await new Promise((r) => setTimeout(r, 300));
const sel = document.getSelection();
const ranges = sel.getComposedRanges
  ? sel.getComposedRanges({ shadowRoots: [root] })
  : [sel.getRangeAt(0)];
const node = ranges[0]?.startContainer;
const h2 = root.querySelector("article h2");
const inHeading = !!node && (node === h2 || h2.contains(node));
const block = document.querySelector('#block-bar button[data-block="h2"]');
return (
  "| the caret is in the revealed heading: " +
  inHeading +
  "\n| the toolbar shows H2: " +
  block.classList.contains("active")
);
