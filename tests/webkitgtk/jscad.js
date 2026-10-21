// A JSCAD model draws in WebKitGTK too: the sandbox is a MODULE
// worker, and the model an SVG - no WebGL involved.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\n```jscad\nconst { cuboid } = require('@jscad/modeling').primitives\nconst main = () => cuboid({ size: [10, 10, 10] })\nmodule.exports = { main }\n```\n",
);
const root = host.shadowRoot;
let paths = 0;
for (let i = 0; i < 50 && paths === 0; i++) {
  await new Promise((r) => setTimeout(r, 200));
  paths = root.querySelectorAll(
    "figure.folio-jscad .jscad-view svg path",
  ).length;
}
const err = root.querySelector(".jscad-error")?.textContent ?? "";
return `| model drawn (3 faces in iso): ${paths === 3} | no error: ${err === ""}${err ? " " + err : ""}`;
