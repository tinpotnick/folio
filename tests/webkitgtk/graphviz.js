// A Graphviz diagram draws in WebKitGTK (WebAssembly in the desktop
// engine).
const host = document.querySelector("#the-doc");
await host.load("# T\n\n```dot\ndigraph { a -> b -> c }\n```\n");
const root = host.shadowRoot;
let nodes = 0;
for (let i = 0; i < 50 && nodes === 0; i++) {
  await new Promise((r) => setTimeout(r, 200));
  nodes = root.querySelectorAll("figure.folio-dot .code-view svg g.node").length;
}
const err = root.querySelector(".drawn-error")?.textContent ?? "";
return `| graph drawn (3 nodes): ${nodes === 3} | no error: ${err === ""}${err ? " " + err : ""}`;
