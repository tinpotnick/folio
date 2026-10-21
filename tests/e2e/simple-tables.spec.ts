import { expect, test, type Page } from "@playwright/test";

/**
 * Simple tables vs datasets (spec: docs/specs/simple-tables.md): a
 * standard Markdown pipe table stays one; the table bar names the
 * kind and converts explicitly; Insert gives a simple table.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
  return md;
}

const PIPE =
  "# T\n\n| Fruit | Price |\n| ----- | ----- |\n| Apple | 1.20  |\n| Pear  | 0.90  |\n";

test.describe("simple tables", () => {
  test("a pipe table renders as a folio table and says it is a Table", async ({
    page,
  }) => {
    await loadDoc(page, PIPE);
    const fig = page.locator('#the-doc figure[data-table-kind="table"]');
    await expect(fig.locator("tbody tr")).toHaveCount(2);
    // Numbers right-align even with no alignment marker.
    const price = fig.locator('tbody td[data-col-index="1"]').first();
    expect(await price.evaluate((el) => getComputedStyle(el).textAlign)).toBe(
      "right",
    );
    await fig.locator("td").first().click();
    const bar = fig.locator(".folio-inspector");
    await expect(bar.locator(".insp-kind")).toHaveText("Table");
    await expect(bar.locator(".insp-convert")).toHaveText("Make it a dataset");
    // No dataset-only controls on a simple table.
    await expect(bar.locator(".insp-type")).toHaveCount(0);
    // An untouched pipe table round-trips byte-for-byte.
    expect(await source(page)).toBe(PIPE);
  });

  test("editing a cell keeps it a pipe table", async ({ page }) => {
    await loadDoc(page, PIPE);
    const cell = page.locator(
      '#the-doc figure[data-table-kind="table"] td[data-row-index="1"][data-col-index="0"]',
    );
    await cell.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Quince");
    await page.keyboard.press("Tab");
    const md = await source(page);
    expect(md).toContain("| Quince | 0.90  |");
    expect(md).not.toContain(":::");
  });

  test("the Insert table button inserts a pipe table, not a ::: block", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nIntro\n");
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.locator("#btn-table").click();
    await expect(
      page.locator('#the-doc figure[data-table-kind="table"]'),
    ).toHaveCount(1);
    const md = await source(page);
    expect(md).toContain("| Column 1 | Column 2 |");
    expect(md).not.toContain("::: table");
  });

  test("Make it a dataset converts explicitly, typing number columns", async ({
    page,
  }) => {
    await loadDoc(page, PIPE);
    const fig = page.locator("#the-doc figure").first();
    await fig.locator("td").first().click();
    await fig.locator(".insp-convert").click();
    const ds = page.locator('#the-doc figure[data-table-kind="dataset"]');
    await expect(ds).toHaveCount(1);
    await ds.locator("td").first().click();
    await expect(ds.locator(".insp-kind")).toHaveText("Dataset · table-1");
    const md = await source(page);
    expect(md).toContain("::: table {#table-1}");
    expect(md).toContain("{name: Price, type: number}");
    // ...and back: nothing would be lost, so the bar allows it.
    await ds.locator("td").first().click();
    await ds.locator(".insp-convert").click();
    await expect(
      page.locator('#the-doc figure[data-table-kind="table"]'),
    ).toHaveCount(1);
    expect(await source(page)).toContain("| Fruit | Price |");
  });

  test("a dataset with formulas cannot be flattened, and says why", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/field-operations.md");
    const fig = page.locator('#the-doc figure[data-table-id="regional-data"]');
    await fig.locator("td").first().click();
    const convert = fig.locator(".insp-convert");
    await expect(convert).toHaveAttribute("title", /growth is a formula/);
    // The reason is VISIBLE on press, not hover-only.
    await convert.click();
    await expect(fig.locator(".insp-note")).toHaveText(
      "Can't convert: growth is a formula, and formulas need a dataset",
    );
    await expect(fig.locator("table")).toBeVisible();
  });

  test("the palette inserts a dataset", async ({ page }) => {
    await loadDoc(page, "# T\n\nIntro\n");
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("dataset");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Insert a dataset");
    await page.keyboard.press("Enter");
    await expect(
      page.locator('#the-doc figure[data-table-kind="dataset"]'),
    ).toHaveCount(1);
  });
});

test.describe("simple tables: first-contact regressions", () => {
  test("Insert table lands after the caret's paragraph, in view", async ({
    page,
  }) => {
    await page.goto("/");
    const p = page.locator("#the-doc article > p").first();
    await p.click();
    await page.keyboard.press("End");
    await page.locator("#btn-table").click();
    const next = await page
      .locator("#the-doc article > p")
      .first()
      .evaluate((el) => el.nextElementSibling?.getAttribute("data-table-kind"));
    expect(next).toBe("table");
    await expect(
      page.locator('#the-doc figure[data-table-kind="table"]'),
    ).toBeInViewport();
  });

  test("a hand-formatted pipe table survives a view switch untouched", async ({
    page,
  }) => {
    const md =
      "# T\n\n| Fruit   | Qty | Price |\n|:--------|----:|------:|\n| Apple   |   3 |  1.20 |\n";
    await loadDoc(page, md);
    expect(await source(page)).toBe(md);
  });

  test("Chart it draws a chart of the dataset right below it", async ({
    page,
  }) => {
    await loadDoc(page, PIPE);
    const fig = page.locator("#the-doc figure").first();
    await fig.locator("td").first().click();
    await fig.locator(".insp-convert").click();
    await expect(page.locator("#status")).toContainText(
      "Now a dataset (table-1) - Price is now a number column",
    );
    const ds = page.locator('#the-doc figure[data-table-kind="dataset"]');
    await ds.locator("td").first().click();
    await ds.locator(".insp-chart").click();
    const chart = page.locator('#the-doc figure[data-chart-source="table-1"]');
    await expect(chart.locator("svg rect")).toHaveCount(2);
    const md = await source(page);
    expect(md).toContain("source: @table-1");
    expect(md).toContain("select: [Fruit, Price]");
  });

  test("the palette's Insert a chart explains when there is no dataset", async ({
    page,
  }) => {
    await loadDoc(page, PIPE);
    await page.locator("#the-doc td").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("chart");
    await page.keyboard.press("Enter");
    await expect(page.locator("#status")).toContainText(
      "Charts are drawn from a dataset",
    );
  });
});
