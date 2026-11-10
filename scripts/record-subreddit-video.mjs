// Records docs/media/subreddit.mp4 - the r/datavisualization example
// (demo/examples/subreddit-meta.md) as a video for social posts: the
// posts table, one score edited (the charts recompute), then a slow
// scroll through the charts, holding on the activity heatmap.
//
//   npm run dev                       # in another terminal (port 5173)
//   node scripts/record-subreddit-video.mjs [http://localhost:5173]
//
// Needs ffmpeg. Records real video at 1280x720, encodes H.264 at
// 960 wide (crf 28) - Reddit posts mp4 natively.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const out = path.resolve("docs/media/subreddit.mp4");
const size = { width: 1280, height: 720 };
const work = mkdtempSync(path.join(tmpdir(), "folio-sub-"));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: work, size },
});
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
/** Scroll so an element is at the given viewport position, smoothly. */
async function scrollTo(locator, block = "start") {
  await locator.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
}

await page.goto(`${base}/?doc=demo/examples/subreddit-meta.md`);
await page.locator("#the-doc h1").first().waitFor();
await page.mouse.move(900, 300);
await pause(1500);

// Edit the first post's score: every chart over @posts recomputes.
await scrollTo(page.locator('#the-doc figure[data-table-id="posts"]'));
await pause(900);
const cell = page.locator(
  '#the-doc figure[data-table-id="posts"] td[data-row-index="0"][data-col-index="4"]',
);
await clickOn(cell);
await page.keyboard.press("Control+a");
await pause(250);
await page.keyboard.type("9999", { delay: 160 });
await page.keyboard.press("Tab");
await pause(900);

// Slow scroll through the figures, holding on the heatmap.
for (const [id, hold] of [
  ["score-histogram", 1600],
  ["top-posts", 1600],
  ["posts-by-hour", 1600],
  ["avg-score-by-hour", 1400],
  ["activity-heatmap", 3200],
  ["flair-mix", 1800],
]) {
  await scrollTo(page.locator(`#the-doc figure[data-chart-id="${id}"]`), "center");
  await pause(hold);
}
await context.close();
await browser.close();

const video = readdirSync(work).find((f) => f.endsWith(".webm"));
if (!video) throw new Error("no video recorded");
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-i",
  path.join(work, video),
  "-vf",
  "trim=start=0.6,setpts=PTS-STARTPTS,fps=15,scale=960:-1:flags=lanczos",
  "-c:v",
  "libx264",
  "-crf",
  "28",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  out,
]);
rmSync(work, { recursive: true, force: true });
console.log(`${out}: ${Math.round((await import("node:fs")).statSync(out).size / 1024)} KB`);
