import { expect, test, type Page } from "@playwright/test";

/**
 * Rows shown, per table (docs/specs/dataset-browser.md): a dataset's
 * own `show:` sets how many rows the page quotes; the data is never
 * cut.
 */
async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/report.md");
  await page.locator("#the-doc h1").first().waitFor();
}

const fig = (page: Page) =>
  page.locator('#the-doc figure[data-table-id="monthly-sales"]');
const rows = (page: Page) => fig(page).locator("tbody tr");

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return md;
}

async function pick(page: Page, value: string): Promise<void> {
  await fig(page).locator("tbody td").first().click();
  await fig(page).locator(".insp-rows").selectOption(value);
}

test.describe("rows shown per table", () => {
  test("the Rows picker sets show:, all shows every row, default removes it", async ({
    page,
  }) => {
    await open(page);
    // This report's own default (table.rows.show: "24").
    await expect(rows(page)).toHaveCount(24);
    await pick(page, "10");
    await expect(rows(page)).toHaveCount(10);
    await expect(fig(page).locator(".folio-table-more")).toContainText(
      "showing first 10",
    );
    // The bar stays open on the table, showing the choice.
    await expect(fig(page).locator(".insp-rows")).toHaveValue("10");
    expect(await source(page)).toMatch(
      /::: table \{#monthly-sales\}[\s\S]*?\nshow: 10\ncolumns:/,
    );
    // The charts still read every row: all 24 months.
    await expect(
      page
        .locator('#the-doc figure[data-chart-source="monthly-sales"]')
        .first(),
    ).toBeVisible();

    await pick(page, "all");
    await expect(rows(page)).toHaveCount(72);
    await expect(fig(page).locator(".folio-table-more")).toHaveCount(0);
    expect(await source(page)).toContain("\nshow: all\n");

    await pick(page, "default");
    await expect(rows(page)).toHaveCount(24);
    expect(await source(page)).not.toContain("\nshow:");
  });

  test("Ctrl+K finds it by words a user knows", async ({ page }) => {
    await open(page);
    await fig(page).locator("tbody td").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("show fewer rows");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Choose how many rows a table shows");
    await page.keyboard.press("Enter");
    await expect(fig(page).locator(".insp-rows")).toBeFocused();
  });
});
