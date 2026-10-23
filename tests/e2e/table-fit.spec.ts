import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** The design review in folio's default theme, where its eight-column
 * table is wider than the page. */
async function wideTable(page: Page): Promise<void> {
  const md = readFileSync("demo/examples/design-review.md", "utf8").replace(
    "theme: technical",
    "theme: default",
  );
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(md);
  await page.locator("#btn-view").click();
}

/**
 * Wide tables fit their page (spec: docs/specs/table-layout.md): the
 * type shrinks (to 75% at most) before the table scrolls. The design
 * review's eight-column table overflowed in most themes, and a printout
 * clipped it.
 */
test("a wide table shrinks to fit its page", async ({ page }) => {
  await wideTable(page);
  const table = page.locator('#the-doc figure[data-table-id="variants"] table');
  await expect(table).toBeVisible();
  await expect
    .poll(() =>
      table.evaluate((t) => {
        const s = t.parentElement as HTMLElement;
        return s.scrollWidth <= s.clientWidth + 1;
      }),
    )
    .toBe(true);
  await expect(table).toHaveAttribute("data-fit", /0\.\d+/);
  const fit = Number(await table.getAttribute("data-fit"));
  expect(fit).toBeGreaterThanOrEqual(0.75);
  expect(fit).toBeLessThan(1);
});

test("a table that fits keeps its size", async ({ page }) => {
  await page.goto("/?doc=demo/examples/sales-review.md");
  const table = page.locator('#the-doc figure[data-table-id="targets"] table');
  await expect(table).toBeVisible();
  await page.waitForTimeout(300);
  expect(await table.getAttribute("data-fit")).toBe("");
  expect(await table.evaluate((t) => t.style.fontSize)).toBe("");
});

test("a narrower window re-fits the table", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await wideTable(page);
  const table = page.locator('#the-doc figure[data-table-id="variants"] table');
  await expect(table).toBeVisible();
  await page.waitForTimeout(300);
  const wide = Number((await table.getAttribute("data-fit")) || 1);
  await page.setViewportSize({ width: 640, height: 900 });
  await expect
    .poll(async () => Number((await table.getAttribute("data-fit")) || 1))
    .toBeLessThan(wide);
});
