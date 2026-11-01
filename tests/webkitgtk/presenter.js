// The slideshow presenter view in the desktop engine (WebKitGTK):
// a second window opens with ?presenter=1, shows the current slide's
// notes (hidden on the main display), and the two windows sync the
// slide index both ways over BroadcastChannel/localStorage.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => document.querySelector(s);

// Load a small deck through the Markdown editor.
q("#btn-markdown").click();
const ed = q("#editor");
ed.value = "# T\n\n## A\n\nx\n\n## B\n\ny\n\n> note b\n\n## C\n\nz\n";
ed.dispatchEvent(new Event("input", { bubbles: true }));
q("#btn-view").click();
for (let i = 0; i < 40 && !q("#the-doc h2"); i++) await wait(50);
// The play button opens a dropdown: pick "Play slideshow".
q("#btn-play").click();
q("#mi-play").click();
await wait(400);

const popup = window.open(
  location.pathname + "?presenter=1",
  "folio-presenter",
);
let bar = "";
for (let i = 0; i < 60; i++) {
  await wait(250);
  try {
    bar = popup?.document?.querySelector("#presenter-bar")?.textContent ?? "";
  } catch {
    bar = "";
  }
  if (/Slide 1 of 3/.test(bar)) break;
}
const barOk = /Slide 1 of 3/.test(bar) && /now: A/.test(bar);

const pnote = popup?.document
  ?.querySelector("#the-doc")
  ?.shadowRoot?.querySelector(".folio-slide blockquote");
const pnoteVisible =
  !!pnote && popup.getComputedStyle(pnote).display !== "none";
const mnote = document
  .querySelector("#the-doc")
  ?.shadowRoot?.querySelector(".folio-slide > blockquote:last-child");
const mnoteHidden = !!mnote && getComputedStyle(mnote).display === "none";

// The presenter window drives: a keydown there must move the MAIN
// window (which owns the index and broadcasts it back).
popup?.document?.dispatchEvent(
  new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
);
let status = "";
for (let i = 0; i < 40; i++) {
  await wait(250);
  status = q("#status").textContent;
  bar = popup?.document?.querySelector("#presenter-bar")?.textContent ?? "";
  if (/Slide 2 of 3/.test(status) && /Slide 2 of 3/.test(bar)) break;
}
const popupDrives = /Slide 2 of 3/.test(status) && /Slide 2 of 3/.test(bar);

// And the main window drives the presenter.
document.dispatchEvent(
  new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
);
for (let i = 0; i < 40; i++) {
  await wait(250);
  bar = popup?.document?.querySelector("#presenter-bar")?.textContent ?? "";
  if (/Slide 3 of 3/.test(bar)) break;
}
const mainDrives = /Slide 3 of 3/.test(bar);

return (
  "| presenter window opened with counter: " +
  barOk +
  "\n| notes visible in presenter: " +
  pnoteVisible +
  "\n| notes hidden on main display: " +
  mnoteHidden +
  "\n| presenter window drives main: " +
  popupDrives +
  "\n| main window drives presenter: " +
  mainDrives
);
