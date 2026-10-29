// native-key: F1 F1
// A REAL F1 in the desktop engine, pressed while typing in the
// document, opens help (the standard help key) and the second press
// closes it - GTK must not swallow it, nor the typing guard block it.
const host = document.querySelector("#the-doc");
await host.load("# T\n\nType here.\n");
await new Promise((r) => setTimeout(r, 100));
const panel = document.querySelector("#help-panel");
if (!panel.hidden) document.querySelector("#btn-help-close").click();
const art = host.shadowRoot.querySelector("article");
const p = art.querySelector("p");
art.focus();
document.getSelection().setBaseAndExtent(p.firstChild, 4, p.firstChild, 4);
window.__folioSeen = [];
const watch = new MutationObserver(() => window.__folioSeen.push(panel.hidden));
watch.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
window.__folioCheck = () =>
  "| F1 opened help: " +
  (window.__folioSeen[0] === false) +
  " | F1 again closed it: " +
  (window.__folioSeen[1] === true && panel.hidden);
return "set";
