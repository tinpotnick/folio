// The Strudel add-on in the desktop engine (ADR-0026): the kept copy
// (IndexedDB) loads as a module from a blob URL and plays. The files
// come from the local package, as if installed earlier.
const files = ["index.mjs", "assets/clockworker-ZDiUtESR.js"];
// Vite transforms what it serves from node_modules; `?raw` is the
// file exactly as published (the add-on checks its hash).
const texts = await Promise.all(
  files.map((f) =>
    import(`/node_modules/@strudel/web/dist/${f}?raw`).then((m) => m.default),
  ),
);
await new Promise((resolve, reject) => {
  const req = indexedDB.open("folio-addons", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("files");
  req.onsuccess = () => {
    const tx = req.result.transaction("files", "readwrite");
    files.forEach((f, i) =>
      tx.objectStore("files").put(texts[i], `strudel@1.3.0/${f}`),
    );
    tx.oncomplete = resolve;
    tx.onerror = reject;
  };
  req.onerror = reject;
});
// What the add-on loader does (src/audio/strudel-addon.ts): the kept
// module, its clock worker pointed at a blob, imported from a blob.
// (The harness has no audio device, so playing itself cannot be
// checked here - loading is the engine-specific part.)
const clockUrl = URL.createObjectURL(
  new Blob([texts[1]], { type: "text/javascript" }),
);
const patched = texts[0].replace(
  'new URL("assets/clockworker-ZDiUtESR.js", import.meta.url)',
  `new URL(${JSON.stringify(clockUrl)})`,
);
let api = false;
try {
  const m = await import(
    URL.createObjectURL(new Blob([patched], { type: "text/javascript" }))
  );
  api = typeof m.initStrudel === "function" && typeof m.hush === "function";
} catch (e) {
  api = "import failed: " + e;
}
const host = document.querySelector("#the-doc");

await host.load('# T\n\n```strudel\nsound("bd hh sd hh")\n```\n');
await new Promise((r) => setTimeout(r, 200));
const root = host.shadowRoot;
const fig = root.querySelector("figure.folio-strudel");
fig.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
await new Promise((r) => setTimeout(r, 100));
root.querySelector(".strudel-play").click();
await new Promise((r) => setTimeout(r, 4000));
const play = root.querySelector(".strudel-play").textContent;
const err = root.querySelector(".strudel-error");
const asked = !root.querySelector(".strudel-addon").hidden;
root.querySelector(".strudel-stop").click();
return (
  "| the kept player is found (no install prompt): " +
  !asked +
  "\n| it loads from a blob as a module: " +
  api +
  "\n| Play gets past loading (Playing, or this harness's missing audio device): " +
  (/Playing/.test(play) || /Audio device unavailable/.test(err.textContent))
);
