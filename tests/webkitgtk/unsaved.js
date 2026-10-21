// An edited document asks before it is replaced, in WebKitGTK too
// (the desktop app): the wordmark raises the unsaved-changes dialog,
// and Cancel keeps the edit.
const host = document.querySelector("#the-doc");
const root = host.shadowRoot;
const tick = (ms = 100) => new Promise((r) => setTimeout(r, ms));
// An example, not the guide (the guide's edits are play, never unsaved).
root.querySelector('article a[href*="poem"]').click();
await tick(1000);
const p = root.querySelector("article > p");
p.append(" EDITED");
root
  .querySelector("article")
  .dispatchEvent(new InputEvent("input", { bubbles: true }));
await tick();
document.querySelector("#btn-home").click();
await tick(300);
const modal = document.querySelector("#unsaved-modal");
const asked = modal.open;
document.querySelector("#btn-unsaved-cancel").click();
await tick(300);
const kept = root.querySelector("article > p").textContent.includes("EDITED");
return `| asks before replacing: ${asked} | Cancel keeps the edit: ${kept && !modal.open}`;
