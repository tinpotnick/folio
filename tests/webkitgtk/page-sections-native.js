// Page sections in the real engine (WebKitGTK): a ::: page block
// renders as an invisible marker, block elements carry their section
// class, the shadow print style names the section's pages, and
// beforeprint writes the named @page rules into the host stylesheet
// (spec: docs/specs/print.md, "Page sections").
const host = document.querySelector("#the-doc");
await host.load(
  '# Report\n\nIntro.\n\n::: page {#sec-1}\nheader: "Part One"\norientation: landscape\n:::\n\nBody.\n',
);
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const mark = root.querySelector(".folio-pagemark");
const marked = root.querySelector('[data-block-index="3"]');
window.dispatchEvent(new Event("beforeprint"));
await new Promise((r) => setTimeout(r, 100));
const printSections =
  root.querySelector("#folio-print-sections")?.textContent ?? "";
const furniture = document.querySelector("#print-furniture")?.textContent ?? "";
const screenDisplay = mark ? getComputedStyle(mark).display : "missing";
return [
  "",
  "page marker rendered: " + (!!mark ? "true" : "false"),
  "marker hidden on screen: " + (screenDisplay === "none" ? "true" : "false"),
  "marker carries its section class: " +
    (mark && mark.classList.contains("folio-sec-1") ? "true" : "false"),
  "block after it is in section 1: " +
    (marked && marked.classList.contains("folio-sec-1") ? "true" : "false"),
  "shadow print style names the page: " +
    (printSections.includes(".folio-sec-1 { page: folio-sec-1; }")
      ? "true"
      : "false"),
  "host furniture has the named @page with landscape size: " +
    (furniture.includes("@page folio-sec-1 { size: A4 landscape;") &&
    furniture.includes('@top-left { content: "Part One";')
      ? "true"
      : "false"),
  "base page keeps the title header and numbers: " +
    (furniture.includes('@page { @top-left { content: "Report";') &&
    furniture.includes("counter(page)")
      ? "true"
      : "false"),
].join(" | ");
