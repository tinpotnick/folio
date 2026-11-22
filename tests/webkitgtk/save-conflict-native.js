// native-key: Escape
// The save-conflict dialog in the real engine (WebKitGTK): the file
// changed on disk since the last save, Save opens the dialog, and a
// REAL Esc cancels it - nothing is written (spec:
// docs/specs/save-conflicts.md). The Tauri bridge is stubbed with a
// virtual file, as in the Chromium e2e.
const host = document.querySelector("#the-doc");
const tick = (ms = 100) => new Promise((r) => setTimeout(r, ms));
const PATH = "/tmp/webkitgtk/report.md";
const w = window;
w.__files = {};
w.__cmds = [];
w.__TAURI_INTERNALS__ = {
  transformCallback: () => 0,
  invoke: async (cmd, args) => {
    w.__cmds.push({ cmd, args });
    if (cmd === "save_document") {
      w.__files[PATH] = { text: String(args.text), mtimeMs: 1000 };
      return PATH;
    }
    if (cmd === "write_document") {
      const f = w.__files[String(args.path)];
      if (!f) throw new Error("gone");
      f.text = String(args.text);
      f.mtimeMs += 1;
      return null;
    }
    if (cmd === "stat_document") {
      const f = w.__files[String(args.path)];
      return f ? { mtimeMs: f.mtimeMs, size: f.text.length } : null;
    }
    if (cmd === "read_document") {
      const f = w.__files[String(args.path)];
      if (!f) throw new Error("gone");
      return f.text;
    }
    return null;
  },
};
await host.load("# T\n\nsame line\n");
await tick(200);
// First save: the Save As path; the file and its stat are remembered.
document.querySelector("#btn-save").click();
for (let i = 0; i < 50 && !w.__cmds.some((c) => c.cmd === "stat_document"); i++)
  await tick(100);
await tick(300);
// External edit and a local edit on the SAME line: a conflict hunk.
w.__files[PATH].text = "# T\n\nEXTERNAL\n";
w.__files[PATH].mtimeMs += 100;
const p = host.shadowRoot.querySelector("article > p");
p.append(" LOCAL");
host.shadowRoot
  .querySelector("article")
  .dispatchEvent(new InputEvent("input", { bubbles: true }));
document.querySelector("#btn-save").click();
let wasOpen = false;
for (let i = 0; i < 50; i++) {
  await tick(100);
  if (document.querySelector("#save-conflict-modal").open) {
    wasOpen = true;
    break;
  }
}
window.__wasOpen = wasOpen;
window.__folioCheck = () => {
  const modal = document.querySelector("#save-conflict-modal");
  const writes = w.__cmds.filter((c) => c.cmd === "write_document").length;
  return `| dialog opened on conflict: ${window.__wasOpen} | Esc closes it: ${!modal.open} | nothing written: ${writes === 0}`;
};
return "set";
