import { expect, test, type Page } from "@playwright/test";

/**
 * Shipped demo data + the report example (spec: docs/specs/
 * data-import.md): the palette imports the demo CSV without a
 * file dialog, and "Open example: report" shows the finished
 * imported-data report - windowed table, running formulas, line
 * charts.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function runPaletteCommand(page: Page, query: string): Promise<void> {
  await page.keyboard.press("Control+k");
  await page.locator("#palette-input").fill(query);
  await page.locator("#palette-list .palette-item").first().click();
  await expect(page.locator("#palette-modal")).toBeHidden();
}

test.describe("demo data and the report example", () => {
  test("the demo dataset imports through the palette", async ({ page }) => {
    await waitForDocument(page);
    await runPaletteCommand(page, "demo dataset");
    const fig = page.locator('figure[data-table-id="monthly_sales"]');
    await expect(fig.locator("tbody tr")).toHaveCount(50);
    await expect(fig.locator(".folio-table-more")).toContainText("72 rows");
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain('import: "monthly-sales.csv"');
    expect(md).toContain("{name: revenue, type: number}");
  });

  test("the report example opens and its data is live", async ({ page }) => {
    await waitForDocument(page);
    await runPaletteCommand(page, "report");
    await expect(
      page.locator("folio-doc h1", { hasText: "Two-year sales report" }),
    ).toBeVisible();
    const fig = page.locator('figure[data-table-id="monthly-sales"]');
    // The example sets table.rows.show: 24 - a document-chosen
    // window over 72 rows.
    await expect(fig.locator("tbody tr")).toHaveCount(24);
    await expect(fig.locator(".folio-table-more")).toContainText(
      "72 rows × 5 columns",
    );
    // Running formula: the growth column renders percents.
    await expect(
      fig.locator('td[data-row-index="1"][data-col-index="4"]'),
    ).toHaveText("-2.7%");
    // Two line charts over the imported data.
    await expect(
      page.locator('figure[data-chart-source="monthly-sales"] svg polyline'),
    ).toHaveCount(2);
    await expect(
      page.locator("figure figcaption", { hasText: "North region revenue" }),
    ).toBeVisible();
    // The dataset browser sees all 72 rows.
    await fig.locator(".ds-open").click();
    await expect(page.locator(".folio-ds-count")).toContainText("72 rows");
    await page.locator(".folio-ds-filter").fill("region == 'South'");
    await expect(page.locator(".folio-ds-count")).toContainText(
      "24 rows of 72",
    );
  });
});
