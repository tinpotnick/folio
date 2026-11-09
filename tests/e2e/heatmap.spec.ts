import { expect, test, type Page } from "@playwright/test";

/**
 * The heatmap chart type (spec: docs/specs/chart-rendering.md,
 * "Heatmap"): a grouped query over two category columns and an
 * aggregate renders as a cell matrix on the theme's ramp, live -
 * edit the table and the cells re-color. The type is an icon in the
 * chart bar's segmented picker; "Insert a heatmap chart" is a
 * palette/Insert-menu entry.
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

const DOC = `# T

::: table {#calls}
columns:
  - {name: hour, type: number}
  - {name: day, type: text}
  - {name: n, type: number}
data:
  - [9, Mon, 2]
  - [9, Tue, 5]
  - [18, Mon, 7]
  - [18, Wed, 1]
:::

::: chart {#hm}
source: @calls
query: {group: [hour, day], agg: {n: sum(n)}}
type: heatmap
caption: "Calls by hour and day"
:::
`;

test.describe("heatmap charts", () => {
  test("a grouped query renders a cell matrix: gaps, cells, tooltips, legend", async ({
    page,
  }) => {
    await loadDoc(page, DOC);
    const fig = page.locator('#the-doc figure[data-chart-id="hm"]');
    await expect(fig.locator(".chart-holder svg")).toBeVisible();
    // 2 hours x 3 days = 6 gap cells; 4 present combinations.
    await expect(fig.locator("rect.heat-gap")).toHaveCount(6);
    await expect(fig.locator("rect.heat-cell")).toHaveCount(4);
    // The busiest cell carries its value in the tooltip.
    await expect(
      fig.locator("rect.heat-cell title", { hasText: "18, Mon: 7" }),
    ).toHaveCount(1);
    // The legend names the value column and its extremes (1 and 7).
    const svg = fig.locator(".chart-holder svg");
    await expect(svg).toContainText("n");
    await expect(svg).toContainText("7");
    // Axis titles name both category columns.
    await expect(svg.locator(".axis-title", { hasText: "hour" })).toHaveCount(
      1,
    );
    await expect(svg.locator(".axis-title", { hasText: "day" })).toHaveCount(1);
    // Cells carry value labels when they fit (2x3 cells are big).
    await expect(fig.locator("text.v-label")).toHaveCount(4);
    const md = await source(page);
    expect(md).toContain("type: heatmap");
  });

  test("editing the table re-colors the heatmap live", async ({ page }) => {
    await loadDoc(page, DOC);
    const fig = page.locator('#the-doc figure[data-chart-id="hm"]');
    await expect(fig.locator(".chart-holder svg")).toBeVisible();
    await expect(
      fig.locator("rect.heat-cell title", { hasText: "18, Mon: 7" }),
    ).toHaveCount(1);
    // Change 7 to 70 in the table: the cell's tooltip follows.
    await page
      .locator(
        '#the-doc figure[data-table-id="calls"] td[data-row-index="2"][data-col-index="2"]',
      )
      .click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("70");
    await page.keyboard.press("Tab");
    await expect(
      fig.locator("rect.heat-cell title", { hasText: "18, Mon: 70" }),
    ).toHaveCount(1);
  });

  test("the chart bar's type icons switch a chart to heatmap and back", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/field-operations.md");
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    const fig = page.locator(
      '#the-doc figure[data-chart-source="regional-data"]',
    );
    await fig.locator(".chart-holder").click();
    const insp = fig.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    // Seven type icons; the active one is marked.
    await expect(insp.locator(".insp-type button")).toHaveCount(7);
    await expect(
      insp.locator('.insp-type button[data-type="bar"]'),
    ).toHaveAttribute("aria-pressed", "true");
    // Switch to heatmap: the chart needs three columns, so set
    // Columns to region, q2, growth first -> one cell per region.
    await insp.locator(".insp-select").fill("region, q2, growth");
    await insp.locator(".insp-select").press("Enter");
    await insp.locator('.insp-type button[data-type="heatmap"]').click();
    await expect(fig.locator("rect.heat-cell")).toHaveCount(3);
    await expect(
      insp.locator('.insp-type button[data-type="heatmap"]'),
    ).toHaveAttribute("aria-pressed", "true");
    const md = await source(page);
    expect(md).toContain("type: heatmap");
    // And back to bar: no heat cells remain, bars draw again.
    await fig.locator(".chart-holder").click();
    await insp.locator('.insp-type button[data-type="bar"]').click();
    await expect(fig.locator("rect.heat-cell")).toHaveCount(0);
    await expect(fig.locator(".chart-holder svg rect").first()).toBeVisible();
    const md2 = await source(page);
    expect(md2).toContain("type: bar");
  });

  test("the demo's activity heatmap draws the hour x day matrix", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/subreddit-meta.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator(
      '#the-doc figure[data-chart-id="activity-heatmap"]',
    );
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".chart-holder svg")).toBeVisible({
      timeout: 15_000,
    });
    // 24 hours x 7 days of gap cells; at most 168 value cells.
    await expect(fig.locator("rect.heat-gap")).toHaveCount(24 * 7);
    const cells = await fig.locator("rect.heat-cell").count();
    expect(cells).toBeGreaterThan(0);
    expect(cells).toBeLessThanOrEqual(24 * 7);
    // 24 narrow columns: cell labels are omitted (never cluttered).
    await expect(fig.locator("text.v-label")).toHaveCount(0);
    // X ticks are thinned like any dense axis.
    const ticks = await fig.locator(".x-tick").count();
    expect(ticks).toBeLessThanOrEqual(9);
  });

  test("the palette's Insert a heatmap chart groups by the first two text columns", async ({
    page,
  }) => {
    await loadDoc(page, DOC);
    // Caret in the table, then the palette entry.
    await page
      .locator(
        '#the-doc figure[data-table-id="calls"] td[data-row-index="0"][data-col-index="0"]',
      )
      .click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert a heatmap");
    await page.keyboard.press("Enter");
    // A second chart appeared, typed heatmap, grouped hour x day.
    const figs = page.locator('#the-doc figure[data-chart-source="calls"]');
    await expect(figs).toHaveCount(2);
    await expect(figs.nth(1).locator("rect.heat-cell")).toHaveCount(4);
    const md = await source(page);
    expect(md).toContain("type: heatmap");
    expect(md).toContain("group: [hour, day]");
  });
});
