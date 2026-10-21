import { expect, test, type Page } from "@playwright/test";

/**
 * The dataset browser (spec: docs/specs/dataset-browser.md): big
 * tables show a head window in flow; the full dataset is browsed
 * in a dedicated overlay - Jexl filter, view sort, cell editing -
 * and charts/formulas always see every model row.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await waitForDocument(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

function bigTableDoc(rows: number, style = ""): string {
  const data = Array.from(
    { length: rows },
    (_, i) => `  - [Region ${String(i)}, ${String(i)}]`,
  ).join("\n");
  return `${style}# T

::: table {#big}
columns:
  - {name: region, type: text}
  - {name: v, type: number}
  - {name: d, type: formula, expr: "v * 2"}
data:
${data}
:::

::: chart {#c}
source: @big
query: {select: [region, v]}
type: bar
:::
`;
}

test.describe("table viewport", () => {
  test("a table longer than the window shows head rows + a status line", async ({
    page,
  }) => {
    await loadDoc(page, bigTableDoc(120));
    const fig = page.locator('figure[data-table-id="big"]');
    await expect(fig.locator("tbody tr")).toHaveCount(50);
    await expect(fig.locator(".folio-table-more")).toContainText(
      "120 rows × 3 columns",
    );
    await expect(fig.locator(".folio-table-more")).toContainText(
      "showing first 50",
    );
    // The chart queries the MODEL: all 120 rows are plotted even
    // though the figure shows 50.
    await expect(
      page.locator('figure[data-chart-source="big"] svg rect'),
    ).toHaveCount(120);
  });

  test("the table.rows.show style key controls the window", async ({
    page,
  }) => {
    await loadDoc(
      page,
      bigTableDoc(20, "---\nstyle:\n  table.rows.show: 10\n---\n\n"),
    );
    const fig = page.locator('figure[data-table-id="big"]');
    await expect(fig.locator("tbody tr")).toHaveCount(10);
    await expect(fig.locator(".folio-table-more")).toContainText(
      "showing first 10",
    );
  });

  test("small tables render exactly as before", async ({ page }) => {
    await waitForDocument(page);
    await expect(
      page.locator('figure[data-table-id="regional-data"] tbody tr'),
    ).toHaveCount(3);
    await expect(
      page.locator('figure[data-table-id="regional-data"] .folio-table-more'),
    ).toHaveCount(0);
  });
});

test.describe("dataset browser", () => {
  async function openBig(page: Page, rows = 120): Promise<void> {
    await loadDoc(page, bigTableDoc(rows));
    await page.locator('figure[data-table-id="big"] .ds-open').click();
    await expect(page.locator(".folio-ds-overlay")).toBeVisible();
  }

  test("opens with every row virtualized and scrollable", async ({ page }) => {
    await openBig(page);
    await expect(page.locator(".folio-ds-count")).toContainText("120 rows");
    await expect(page.locator(".folio-ds-hcell")).toHaveCount(3);
    // Only the visible window is in the DOM...
    expect(await page.locator(".folio-ds-row").count()).toBeLessThan(30);
    // ...but scrolling to the end materializes the last rows.
    await page
      .locator(".folio-ds-grid")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(
      page.locator(".folio-ds-row", { hasText: "Region 119" }),
    ).toBeVisible();
    await expect(page.locator(".folio-ds-row").last()).toContainText("238");
  });

  test("the Jexl filter narrows to matching model rows", async ({ page }) => {
    await openBig(page);
    await page.locator(".folio-ds-filter").fill("v > 115");
    await expect(page.locator(".folio-ds-count")).toContainText(
      "4 rows of 120",
    );
    await expect(page.locator(".folio-ds-row")).toHaveCount(4);
    await expect(page.locator(".folio-ds-row").first()).toContainText(
      "Region 116",
    );
    // A typo'd column is a visible error, not silence.
    await page.locator(".folio-ds-filter").fill("nope > 1");
    await expect(page.locator(".folio-ds-count")).toContainText(
      "unknown column",
    );
  });

  test("clicking a header sorts the view (asc, then desc)", async ({
    page,
  }) => {
    await openBig(page);
    await page.locator(".folio-ds-hcell", { hasText: "v" }).click();
    await expect(page.locator(".folio-ds-count")).toContainText(
      "sorted by v asc",
    );
    await expect(page.locator(".folio-ds-row").first()).toContainText(
      "Region 0",
    );
    await page.locator(".folio-ds-hcell", { hasText: "v ▲" }).click();
    await expect(page.locator(".folio-ds-count")).toContainText(
      "sorted by v desc",
    );
    await expect(page.locator(".folio-ds-row").first()).toContainText(
      "Region 119",
    );
  });

  test("cell edits are model writes: figure, formulas, and source follow", async ({
    page,
  }) => {
    await openBig(page);
    const cell = page
      .locator(".folio-ds-row")
      .first()
      .locator(".folio-ds-cell")
      .first();
    await cell.click();
    await page.locator(".folio-ds-edit").fill("Renamed");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(page.locator(".folio-ds-overlay")).toBeHidden();
    // The in-flow viewport row updated...
    await expect(
      page.locator('figure[data-table-id="big"] tbody tr').first(),
    ).toContainText("Renamed");
    // ...the formula recalculated (d = v * 2 on row 0 = 0)...
    await expect(
      page.locator('figure[data-table-id="big"] tbody tr').first(),
    ).toContainText("0");
    // ...and the Markdown source carries the edit.
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "- [Renamed, 0]",
    );
  });

  test("the inspector's dataset button opens the browser for that table", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page
      .locator(
        'figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="0"]',
      )
      .click();
    await page
      .locator('figure[data-table-id="regional-data"] .insp-dataset')
      .click();
    await expect(page.locator(".folio-ds-overlay")).toBeVisible();
    await expect(page.locator(".folio-ds-title")).toHaveText("@regional-data");
    await expect(page.locator(".folio-ds-count")).toContainText("3 rows");
  });

  test("Esc and Done close the browser", async ({ page }) => {
    await openBig(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(".folio-ds-overlay")).toBeHidden();
    await page.locator('figure[data-table-id="big"] .ds-open').click();
    await expect(page.locator(".folio-ds-overlay")).toBeVisible();
    await page.locator(".folio-ds-done").click();
    await expect(page.locator(".folio-ds-overlay")).toBeHidden();
  });
});
