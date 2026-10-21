// A Vega-Lite chart reading a dataset draws in WebKitGTK too.
const host = document.querySelector("#the-doc");
await host.load(
  '# T\n\n::: table {#d}\ncolumns:\n  - {name: k, type: text}\n  - {name: v, type: number}\ndata:\n  - [a, 3]\n  - [b, 5]\n:::\n\n```vega-lite\n{"data": {"name": "@d"}, "mark": "bar", "encoding": {"x": {"field": "k", "type": "nominal"}, "y": {"field": "v", "type": "quantitative"}}}\n```\n',
);
const root = host.shadowRoot;
let svg = null;
for (let i = 0; i < 50 && !svg; i++) {
  await new Promise((r) => setTimeout(r, 200));
  svg = root.querySelector("figure.folio-vega-lite .code-view svg");
}
const err = root.querySelector(".drawn-error")?.textContent ?? "";
return `| chart drawn: ${!!svg} | no error: ${err === ""}${err ? " " + err : ""}`;
