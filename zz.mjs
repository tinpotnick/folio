import { chromium } from "@playwright/test";
const port = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage();
let navs = 0;
p.on("framenavigated", (f) => { if (f === p.mainFrame()) navs++; });
p.on("pageerror", (e) => console.log("PAGEERR", e.message.slice(0, 200)));
await p.addInitScript(() => localStorage.setItem("folio.guided", "1"));
const t0 = Date.now();
await p.goto(`http://localhost:${port}/?doc=demo/examples/compute.md`);
try {
  await p.locator("#the-doc figure.folio-python .compute-table").first().waitFor({ timeout: 60000 });
  console.log("first table after", ((Date.now() - t0) / 1000).toFixed(1), "s; page loads:", navs);
} catch { console.log("no table in 60 s; page loads:", navs, await p.locator("#the-doc figure.folio-python .code-view").first().innerText()); }
await b.close();
