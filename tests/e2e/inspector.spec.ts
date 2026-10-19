import { expect, test, type Page } from "@playwright/test";

/**
 * The table inspector: an Excel-style bar at the top of a table
 * figure. Clicking a cell shows the clicked column's properties -
 * name, type, unit, format, and for formula columns the ƒx
 * expression - all editable in place. The document stays the
 * source of truth: edits are model writes, exactly like editing
 * the YAML by hand.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

function inspector(page: Page) {
  return page.locator(
    '#the-doc figure[data-table-id="regional-data"] .folio-inspector',
  );
}

test.describe("table inspector", () => {
  test("hidden until a cell is clicked; visible with the column's data", async ({
    page,
  }) => {
    await waitForDocument(page);
    await expect(inspector(page)).toBeHidden();
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="1"]',
      )
      .click();
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page).locator(".insp-col")).toHaveValue("1");
    await expect(inspector(page).locator(".insp-type")).toHaveValue("number");
    await expect(inspector(page).locator(".insp-unit")).toHaveValue("£k");
    // Clicking the formula column shows the ƒx expression.
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      )
      .click();
    await expect(inspector(page).locator(".insp-col")).toHaveValue("3");
    await expect(inspector(page).locator(".insp-expr")).toBeVisible();
    await expect(inspector(page).locator(".insp-expr")).toHaveValue(
      "(q3 - q2) / q2",
    );
  });

  test("clicking away from the table hides the bar", async ({ page }) => {
    await waitForDocument(page);
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="1"]',
      )
      .click();
    await expect(inspector(page)).toBeVisible();
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(inspector(page)).toBeHidden();
  });

  test("editing the formula recalculates the column", async ({ page }) => {
    await waitForDocument(page);
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      )
      .click();
    await inspector(page).locator(".insp-expr").fill("q3 - q2");
    await inspector(page).locator(".insp-expr").press("Enter");
    // The column keeps its percent format: 89 renders as 8900%.
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      ),
    ).toHaveText("8900.0%");
    await inspector(page).locator(".insp-format").selectOption("default");
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      ),
    ).toHaveText("89");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'expr: "q3 - q2"',
    );
  });

  test("editing the unit updates the header and the source", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="1"]',
      )
      .click();
    await inspector(page).locator(".insp-unit").fill("£m");
    await inspector(page).locator(".insp-unit").press("Enter");
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="regional-data"] th[data-col-index="1"] .unit',
      ),
    ).toHaveText(" (£m)");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain('unit: "£m"');
  });

  test("units are visible in headers without hovering (dead metadata no more)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="regional-data"] th[data-col-index="1"]',
      ),
    ).toHaveText("q2 (£k)");
  });

  test("changing the column type reaches the source", async ({ page }) => {
    await waitForDocument(page);
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="1"]',
      )
      .click();
    await inspector(page).locator(".insp-type").selectOption("text");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "{name: q2, type: text",
    );
  });

  test("headers, captions, and charts are not editable surfaces", async ({
    page,
  }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    // The table element carries the explicit no-editing flag; the
    // header (no attribute of its own) inherits it.
    const tableEditable = await table
      .locator("table")
      .evaluate((el) => (el as HTMLElement).contentEditable);
    expect(tableEditable).toBe("false");
    const capEditable = await table
      .locator("figcaption")
      .evaluate((el) => (el as HTMLElement).contentEditable);
    expect(capEditable).toBe("false");
    // The real user contract: clicking a header and typing never
    // changes the generated header text.
    await table.locator('th[data-col-index="1"]').click();
    await page.keyboard.type("X");
    await expect(table.locator('th[data-col-index="1"]')).toHaveText("q2 (£k)");
    const chartEditable = await page
      .locator('#the-doc figure[data-chart-source="regional-data"]')
      .evaluate((el) => (el as HTMLElement).contentEditable);
    expect(chartEditable).toBe("false");
    // Data cells remain the editable leaves.
    const tdEditable = await table
      .locator('td[data-row-index="0"][data-col-index="1"]')
      .evaluate((el) => (el as HTMLElement).contentEditable);
    expect(tdEditable).toBe("true");
  });

  test("the caption is edited through the inspector, not in place", async ({
    page,
  }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    await table.locator('td[data-row-index="0"][data-col-index="1"]').click();
    const insp = table.locator(".folio-inspector");
    await expect(insp.locator(".insp-caption")).toHaveValue(
      "Q3 revenue by region (GBP thousands)",
    );
    await insp.locator(".insp-caption").fill("Q3 revenue by region");
    await insp.locator(".insp-caption").press("Enter");
    await expect(table.locator("figcaption")).toHaveText(
      "Q3 revenue by region",
    );
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'caption: "Q3 revenue by region"',
    );
  });

  test("the format select drives percent rendering", async ({ page }) => {
    await waitForDocument(page);
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      )
      .click();
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      ),
    ).toHaveText("21.6%");
    await inspector(page).locator(".insp-format").selectOption("default");
    // Plain rendering shows the raw ratio.
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="3"]',
      ),
    ).toHaveText(/0\.21601/);
  });
});
