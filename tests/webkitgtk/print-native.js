// native-key: ctrl+p
// A REAL Ctrl+P prints. WebKitGTK (the desktop app) has no browser
// menu binding Ctrl+P, so it did nothing until folio bound it.
let printed = 0;
window.print = () => {
  printed += 1;
};
document.body.focus();
window.__folioCheck = () => "| real Ctrl+P prints: " + (printed === 1);
