// ABC sheet music engraves in WebKitGTK too.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\n```abc\nX:1\nT:t\nM:4/4\nL:1/4\nK:C\nC D E F | G4 |]\n```\n",
);
const root = host.shadowRoot;
let notes = 0;
for (let i = 0; i < 50 && notes === 0; i++) {
  await new Promise((r) => setTimeout(r, 200));
  notes = root.querySelectorAll("figure.folio-abc .abcjs-note").length;
}
return `| score engraved (5 notes): ${notes === 5}`;
