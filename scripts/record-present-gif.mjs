// Records docs/media/present.gif - the README's slideshow demo: the
// Quarterly review deck as a document, a number changed (its growth and
// chart follow), then Play: the same document as slides, the new number
// carried through to the chart.
//
//   npm run dev                       # in another terminal (port 5173)
//   node scripts/record-present-gif.mjs [http://localhost:5173]
//
// Needs ffmpeg. Records real video at 1280x720 (a 16:9 slide fills it
// exactly) and turns it into a GIF with a generated palette, so the
// frames are the app as it renders - nothing cropped or scaled per
// frame.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const out = path.resolve("docs/media/present.gif");
const size = { width: 1280, height: 720 };
const work = mkdtempSync(path.join(tmpdir(), "folio-gif-"));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: work, size },
});
// Play asks for fullscreen; headless Chromium's "screen" is 800x600
// whatever it is told, so a granted fullscreen shrank the page to that
// mid-recording and froze the video - the slides in a corner of a grey
// frame (the clipped GIFs). Fullscreen only removes the browser's own
// furniture, which a recording has none of: the viewport IS the screen.
await context.addInitScript(() => {
  Element.prototype.requestFullscreen = () => Promise.resolve();
});
const page = await context.newPage();
// A visible pointer (video captures none), and a ring on each click.
await page.addInitScript(() => {
  localStorage.setItem("folio.guided", "1");
  addEventListener("DOMContentLoaded", () => {
    // The pointer goes once the show starts: a presenter's slides
    // have none.
    const hide = document.createElement("style");
    hide.textContent = "html.playing #rec-pointer { display: none; }";
    document.head.appendChild(hide);
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
    addEventListener(
      "mousedown",
      () => (dot.style.transform = "scale(.6)"),
      true,
    );
    addEventListener("mouseup", () => (dot.style.transform = ""), true);
  });
});
const pause = (ms) => page.waitForTimeout(ms);
/** Glide the pointer to an element, then click it. */
async function clickOn(locator, steps = 25) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("nothing to click");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps,
  });
  await pause(150);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

await page.goto(`${base}/?doc=demo/examples/deck.md`);
await page.locator("#the-doc h1").first().waitFor();
await page.mouse.move(900, 300);
await pause(1600);

// The document: scroll to its table and chart.
await page
  .locator('#the-doc figure[data-table-id="deck-regional"]')
  .evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
await pause(1400);

// Change South's Q3: growth and the chart's order follow.
const cell = page.locator(
  '#the-doc figure[data-table-id="deck-regional"] td[data-row-index="1"][data-col-index="2"]',
);
await clickOn(cell);
await page.keyboard.press("Control+a");
await pause(250);
await page.keyboard.type("520", { delay: 180 });
await page.keyboard.press("Tab");
await pause(500);
await page.mouse.move(1150, 420, { steps: 20 });
await pause(2200);

// Play: the same document as slides.
await clickOn(page.locator("#btn-play"));
await pause(450);
await clickOn(page.getByText("Play slideshow", { exact: true }).last(), 12);
await pause(1900);
for (const hold of [2100, 2600]) {
  await page.keyboard.press("ArrowRight");
  await pause(hold);
}
await context.close();
await browser.close();

const video = readdirSync(work).find((f) => f.endsWith(".webm"));
if (!video) throw new Error("no video recorded");
const src = path.join(work, video);
const palette = path.join(work, "palette.png");
// Skip the first moments (the page loading), 12 fps, 960 wide.
const filters =
  "trim=start=0.6,setpts=PTS-STARTPTS,fps=12,scale=960:-1:flags=lanczos";
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
  `${filters} [x]; [x][1:v] paletteuse=dither=sierra2_4a:diff_mode=rectangle`,
  "-loop",
  "0",
  out,
]);
rmSync(work, { recursive: true, force: true });
console.log(`${out}: ${(statSync(out).size / 1048576).toFixed(1)} MB`);
