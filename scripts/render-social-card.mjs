// Renders docs/media/social.png - the card GitHub, Mastodon, Slack and
// the like show when folio's link is shared (upload it in the repo's
// Settings -> Social preview). 1280x640, GitHub's size.
//
//   npm run dev                         # in another terminal
//   node scripts/render-social-card.mjs [http://localhost:5173]
//
// It captures real pieces of the app (a report's summary table and a
// chart, and the same kind of document playing as a slide), then lays
// them out beside the wordmark and the pitch, so the card always shows
// the app as it is.
import { chromium } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const out = path.resolve("docs/media/social.png");
const work = mkdtempSync(path.join(tmpdir(), "folio-card-"));
const asData = (file, type = "image/png") =>
  `data:${type};base64,${readFileSync(file).toString("base64")}`;
const font = (pkg, file) =>
  asData(`node_modules/@fontsource-variable/${pkg}/files/${file}`, "font/woff2");

const browser = await chromium.launch();

// 1. The pieces, at 2x so they stay crisp scaled down.
const shoot = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
await shoot.addInitScript(() => localStorage.setItem("folio.guided", "1"));
const p = await shoot.newPage();
await p.goto(`${base}/?doc=demo/examples/sales-review.md`);
await p.locator("#the-doc h1").first().waitFor();
await p.evaluate(() => document.querySelector("#the-doc").drawAllFigures());
await p.waitForTimeout(1200);
const h1 = await p.locator("#the-doc h1").first().boundingBox();
const table = await p.locator("#the-doc figure[data-table-id]").first().boundingBox();
await p.screenshot({
  path: `${work}/top.png`,
  clip: {
    x: table.x - 56,
    y: h1.y - 44,
    width: table.width + 112,
    height: table.y + table.height - h1.y + 64,
  },
});
// The product-mix chart: stacked bars read at thumbnail size.
const chart = p
  .locator("#the-doc figure[data-chart-source]")
  .filter({ hasText: "Product mix" })
  .first();
await chart.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await chart.screenshot({ path: `${work}/chart.png` });
await p.goto(`${base}/?doc=demo/examples/deck.md`);
await p.locator("#the-doc h1").first().waitFor();
await p.click("#btn-play");
await p.click("#mi-play");
await p.waitForTimeout(500);
await p.keyboard.press("ArrowRight");
await p.keyboard.press("ArrowRight");
await p.waitForTimeout(1000);
await p.evaluate(() => {
  document.querySelector("#status").style.display = "none";
});
await p.locator("#the-doc .folio-slide").nth(2).screenshot({ path: `${work}/slide.png` });
await shoot.close();

// 2. The card.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "EB Garamond"; src: url(${font("eb-garamond", "eb-garamond-latin-wght-normal.woff2")}); font-weight: 400 800; }
@font-face { font-family: "EB Garamond"; font-style: italic; src: url(${font("eb-garamond", "eb-garamond-latin-wght-italic.woff2")}); font-weight: 400 800; }
@font-face { font-family: "Inter"; src: url(${font("inter", "inter-latin-wght-normal.woff2")}); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { width: 1280px; height: 640px; overflow: hidden; position: relative;
  background: radial-gradient(120% 140% at 0% 0%, #fbf8f1 0%, #f4efe4 55%, #ece4d3 100%);
  font-family: Inter, sans-serif; color: #1d1c1a; }
.copy { position: absolute; left: 72px; top: 70px; width: 520px; }
.wordmark { height: 74px; display: block; margin-left: -6px; }
h1 { font-family: "EB Garamond", serif; font-weight: 600; font-size: 54px;
  line-height: 1.04; letter-spacing: -0.5px; margin-top: 34px; }
h1 em { color: #ef5b33; font-style: italic; }
p { font-size: 22px; line-height: 1.45; color: #4a463f; margin-top: 22px; }
p b { color: #1d1c1a; font-weight: 600; }
.tags { position: absolute; left: 72px; bottom: 60px; display: flex; gap: 10px; }
.tag { font-size: 16px; font-weight: 600; padding: 9px 15px; border-radius: 999px;
  background: #1d1c1a; color: #f4efe4; }
.tag.light { background: rgba(29,28,26,.08); color: #1d1c1a; }
.page { position: absolute; left: 668px; top: 40px; width: 500px; padding: 4px 6px 14px;
  background: #fff; border-radius: 10px; transform: rotate(-2.2deg);
  box-shadow: 0 2px 4px rgba(0,0,0,.06), 0 24px 60px rgba(60,45,20,.22); }
.page img { display: block; width: 100%; }
.page .chart { width: 92%; margin: 2px auto 0; }
.slide { position: absolute; left: 900px; top: 420px; width: 340px; border-radius: 8px;
  transform: rotate(3deg); overflow: hidden;
  box-shadow: 0 0 0 6px #111318, 0 30px 70px rgba(0,0,0,.4); }
.slide img { display: block; width: 100%; }
.play { position: absolute; left: 874px; top: 402px; width: 54px; height: 54px; border-radius: 50%;
  background: #ef5b33; box-shadow: 0 8px 22px rgba(239,91,51,.45); z-index: 2;
  display: grid; place-items: center; }
.play::after { content: ""; margin-left: 5px; border-left: 18px solid #fff;
  border-top: 11px solid transparent; border-bottom: 11px solid transparent; }
</style></head><body>
<div class="copy">
  <img class="wordmark" src="${asData("docs/media/wordmark-light.png")}" alt="">
  <h1>The document Word <em>should have been.</em></h1>
  <p>Live tables, charts, <b>Python</b> and <b>slides</b> &mdash; in one plain Markdown file you own.</p>
</div>
<div class="tags">
  <span class="tag">Free &amp; open source</span>
  <span class="tag light">Desktop &amp; web</span>
  <span class="tag light">Works offline</span>
</div>
<div class="page">
  <img src="${asData(`${work}/top.png`)}" alt="">
  <img class="chart" src="${asData(`${work}/chart.png`)}" alt="">
</div>
<div class="play"></div>
<div class="slide"><img src="${asData(`${work}/slide.png`)}" alt=""></div>
</body></html>`;
const card = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await card.setContent(html, { waitUntil: "load" });
await card.evaluate(() => document.fonts.ready);
await card.screenshot({ path: out });
await browser.close();
rmSync(work, { recursive: true, force: true });
console.log(`${out}: 1280x640`);
