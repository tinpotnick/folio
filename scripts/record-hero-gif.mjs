// Records docs/media/hero.gif - the README's hero: editing a number
// in the field-operations table; the growth formula column and the
// bar chart re-sort as you type.
//
//   npm run dev                       # in another terminal (port 5173)
//   node scripts/record-hero-gif.mjs [http://localhost:5173]
//
// Needs ffmpeg. Records real video at 1280x720 and turns it into a
// GIF with a generated palette (same pipeline as record-present-gif).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const out = path.resolve("docs/media/hero.gif");
const size = { width: 1280, height: 720 };
const work = mkdtempSync(path.join(tmpdir(), "folio-hero-"));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: work, size },
});
// A visible pointer (video captures none), and a ring on each click.
await context.addInitScript(() => {
  localStorage.setItem("folio.guided", "1");
  addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.id = "rec-pointer";
    dot.style.cssText =
      "position:fixed;z-index:99999;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(239,91,51,.85);box-shadow:0 0 0 3px rgba(255,255,255,.9),0 2px 8px rgba(0,0,0,.35);pointer-events:none;transition:transform .12s";
    document.body.appendChild(dot);
    addEventListener(
      "mousemove",
      (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
      },
      true,
    );
    addEventListener("mousedown", () => (dot.style.transform = "scale(.6)"), true);
    addEventListener("mouseup", () => (dot.style.transform = ""), true);
  });
});
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
async function clickOn(locator, steps = 25) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("nothing to click");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps,
  });
  await pause(150);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

await page.goto(`${base}/?doc=demo/examples/field-operations.md`);
await page.locator("#the-doc h1").first().waitFor();
await page.mouse.move(900, 300);
await pause(1400);

// The table and its chart, both in frame.
await page
  .locator('#the-doc figure[data-table-id="regional-data"]')
  .evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
await pause(1200);

// Change South's Q3: the growth formula and the chart's order follow.
const cell = page.locator(
  '#the-doc figure[data-table-id="regional-data"] td[data-row-index="1"][data-col-index="2"]',
);
await clickOn(cell);
await page.keyboard.press("Control+a");
await pause(250);
await page.keyboard.type("520", { delay: 180 });
await page.keyboard.press("Tab");
await pause(600);

// Scroll to the chart: the bars have re-sorted with the new growth.
await page
  .locator('#the-doc figure[data-chart-id="growth-chart"]')
  .evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
await pause(2200);
await context.close();
await browser.close();

const video = readdirSync(work).find((f) => f.endsWith(".webm"));
if (!video) throw new Error("no video recorded");
const src = path.join(work, video);
const palette = path.join(work, "palette.png");
// Skip the first moments (page loading), 12 fps, 900 wide.
const filters = "trim=start=0.6,setpts=PTS-STARTPTS,fps=12,scale=900:-1:flags=lanczos";
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-i",
  src,
  "-vf",
  `${filters},palettegen=stats_mode=diff`,
  palette,
]);
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-i",
  src,
  "-i",
  palette,
  "-lavfi",
  `${filters} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4`,
  out,
]);
rmSync(work, { recursive: true, force: true });
console.log(`${out}: ${Math.round((await import("node:fs")).statSync(out).size / 1024)} KB`);
