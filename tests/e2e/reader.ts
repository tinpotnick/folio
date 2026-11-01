import type { Locator, Page } from "@playwright/test";

/**
 * Figures draw lazily, as they come near the screen (docs/specs/
 * section-windowing.md, "lazy figures"). A test that checks a figure
 * does what a reader does first: scrolls to it.
 */

/** Scroll the whole document past the screen, as a reader skims it,
 * so every figure draws; then back to the top. */
export async function readThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = (): Promise<void> =>
      new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));
    // The page grows as figures draw: the end is re-read each step.
    for (let y = 0; y < document.documentElement.scrollHeight;) {
      scrollTo(0, y);
      await frame();
      y += Math.max(200, innerHeight * 0.8);
    }
    scrollTo(0, 0);
    await frame();
  });
}

/** Scroll one figure into view, as a reader does before looking at it. */
export async function scrollToFigure(figure: Locator): Promise<void> {
  await figure.scrollIntoViewIfNeeded();
}
