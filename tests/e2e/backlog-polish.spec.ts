import { expect, test } from "@playwright/test";

/** Small first-contact fixes: each test failed before its fix. */

const SAMPLE = "/?doc=demo/examples/field-operations.md";

test("revealing a table's bar does not move the table", async ({ page }) => {
  await page.goto(SAMPLE);
  const fig = page.locator('#the-doc figure[data-table-id="regional-data"]');
  const table = fig.locator("table");
  await table.scrollIntoViewIfNeeded();
  const before = await table.boundingBox();
  await fig.locator("td").first().click();
  await expect(fig.locator(".folio-inspector")).toBeVisible();
  const after = await table.boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(1);
});

test("the chart bar labels its fields", async ({ page }) => {
  await page.goto(SAMPLE);
  const fig = page.locator("#the-doc figure[data-chart-source]").first();
  await fig.click();
  const labels = await fig.locator(".insp-label").allTextContents();
  expect(labels).toEqual([
    "Data",
    "Type",
    "Columns",
    "Filter",
    "Sort by",
    "Order",
    "Split by",
    "Stack",
    "Caption",
  ]);
  // Labels name the controls for assistive tech too.
  await expect(fig.getByLabel("Filter")).toBeVisible();
});

test("only datasets are offered as a chart's data", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btn-markdown").click();
  await page
    .locator("#editor")
    .fill(
      "# T\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n::: table {#ds}\ncolumns:\n  - {name: x, type: text}\n  - {name: y, type: number}\ndata:\n  - [p, 1]\n:::\n\n::: chart {#c}\nsource: @ds\nquery: {select: [x, y]}\ntype: bar\n:::\n",
    );
  await page.locator("#btn-view").click();
  const fig = page.locator("#the-doc figure[data-chart-source]");
  await fig.click();
  const options = await fig.locator(".insp-source option").allTextContents();
  expect(options).toEqual(["@ds"]);
});

test("clicking a chart caption lights no block button", async ({ page }) => {
  await page.goto(SAMPLE);
  const cap = page
    .locator("#the-doc figure[data-chart-source] figcaption")
    .first();
  await cap.scrollIntoViewIfNeeded();
  await cap.click();
  await expect(page.locator("#block-bar button.active")).toHaveCount(0);
});

test("the help window's title is not flush against its header", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#btn-help").click();
  const head = await page
    .locator("#help-modal .help-head, #help-modal header, #help-modal > div")
    .first()
    .boundingBox();
  const h1 = await page.locator("#help-doc h1").first().boundingBox();
  expect((h1?.y ?? 0) - ((head?.y ?? 0) + (head?.height ?? 0))).toBeGreaterThan(
    12,
  );
});
