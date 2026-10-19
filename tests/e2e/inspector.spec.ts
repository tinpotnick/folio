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
    // The header's NAME is the one editable leaf (the in-place
    // rename); the unit span and the th itself are not.
    const nameEditable = await table
      .locator('th[data-col-index="1"] .name')
      .evaluate((el) => (el as HTMLElement).isContentEditable);
    expect(nameEditable).toBe(true);
    const unitEditable = await table
      .locator('th[data-col-index="1"] .unit')
      .evaluate((el) => (el as HTMLElement).isContentEditable);
    expect(unitEditable).toBe(false);
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

  test("renaming a column in place updates the header, source, and charts", async ({
    page,
  }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    await table.locator('th[data-col-index="0"] .name').click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("area");
    await page.keyboard.press("Enter");
    await expect(table.locator('th[data-col-index="0"]')).toHaveText("area");
    await page.locator("#btn-markdown").click();
    const src = await page.locator("#editor").inputValue();
    expect(src).toContain("{name: area, type: text");
    // The chart selecting the old name follows the rename.
    expect(src).toContain("select: [area, growth]");
  });

  test("a header rename commits on blur as well as Enter", async ({ page }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    await table.locator('th[data-col-index="0"] .name').click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("area");
    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await expect(table.locator('th[data-col-index="0"]')).toHaveText("area");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "{name: area, type: text",
    );
  });

  test("renaming a column a formula references shows an error, not a crash", async ({
    page,
  }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    await table.locator('th[data-col-index="1"] .name').click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("q2b");
    await page.keyboard.press("Enter");
    // The guarded render: the recalc error is shown in place.
    await expect(table.locator(".folio-table-error")).toBeVisible();
    await expect(table.locator(".folio-table-error")).toContainText("q2");
    // The rename still committed to the source, and the app is
    // alive: a paragraph takes typing as normal.
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "{name: q2b, type: number",
    );
    await page.locator("#btn-view").click();
    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await page.keyboard.type(" still");
    await expect(
      page.locator("folio-doc p", { hasText: "Growth was strongest" }),
    ).toContainText("still");
  });

  test("Escape reverts an in-progress header rename", async ({ page }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    await table.locator('th[data-col-index="0"] .name').click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("zzz");
    await page.keyboard.press("Escape");
    await expect(table.locator('th[data-col-index="0"]')).toHaveText("region");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "{name: region, type: text",
    );
  });

  test("clearing a header name reverts it - a column always keeps a name", async ({
    page,
  }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    await table.locator('th[data-col-index="0"] .name').click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
    await expect(table.locator('th[data-col-index="0"]')).toHaveText("region");
  });

  test("Tab moves across headers; Enter drops into the column's first cell", async ({
    page,
  }) => {
    await waitForDocument(page);
    const table = page.locator(
      '#the-doc figure[data-table-id="regional-data"]',
    );
    const active = (): Promise<string> =>
      page.locator("#the-doc").evaluate((el) => {
        const a = (el.shadowRoot as ShadowRoot | null)
          ?.activeElement as HTMLElement | null;
        if (a === null) return "none";
        if (a.tagName === "TD") {
          return `TD:${a.dataset.colIndex ?? ""}:${a.dataset.rowIndex ?? ""}`;
        }
        const th = a.closest("th") as HTMLElement | null;
        return th === null ? "OTHER" : `SPAN:${th.dataset.colIndex ?? ""}`;
      });
    await table.locator('th[data-col-index="0"] .name').click();
    await page.keyboard.press("Tab");
    await expect.poll(active).toBe("SPAN:1");
    await page.keyboard.press("Enter");
    await expect.poll(active).toBe("TD:1:0");
  });

  test("editing a header hides the unit and gives the name the full cell", async ({
    page,
  }) => {
    await waitForDocument(page);
    const th = page.locator(
      '#the-doc figure[data-table-id="regional-data"] th[data-col-index="1"]',
    );
    const unit = th.locator(".unit");
    await expect(th).toHaveText("q2 (£k)");
    await th.locator(".name").click();
    await expect(th).toHaveClass(/editing/);
    await expect(unit).toBeHidden();
    // The name fills the cell while editing: the span is the
    // whole header, not a sliver next to the unit.
    const display = await th
      .locator(".name")
      .evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("block");
    // The blue highlight is the CELL's, like a data cell: it
    // fills the whole th, not a box hugging the text.
    const thBg = await th.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(thBg).toBe("rgba(76, 110, 245, 0.07)");
    const nameBg = await th
      .locator(".name")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(nameBg).toBe("rgba(0, 0, 0, 0)");
    await page.keyboard.type("zzz");
    await page.keyboard.press("Escape");
    // Escape reverts the text but keeps the rename session: the
    // caret is still in the name and the unit stays hidden.
    await expect(th).toHaveClass(/editing/);
    await expect(unit).toBeHidden();
    await expect(th).toHaveText("q2 (£k)");
    // Leaving the header ends the session and restores the unit.
    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await expect(th).not.toHaveClass(/editing/);
    await expect(unit).toBeVisible();
  });

  test("clicking anywhere in the header (except the unit) starts the rename", async ({
    page,
  }) => {
    await waitForDocument(page);
    const th = page.locator(
      '#the-doc figure[data-table-id="regional-data"] th[data-col-index="1"]',
    );
    // The left edge of the th is padding, not the name span.
    await th.click({ position: { x: 2, y: 8 } });
    await expect(th).toHaveClass(/editing/);
    await page.keyboard.press("Escape");
    // End the rename session by leaving the header.
    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await expect(th).not.toHaveClass(/editing/);
    // The unit is the exception: it opens the column in the
    // inspector and never starts a rename.
    await th.locator(".unit").click();
    await expect(th).not.toHaveClass(/editing/);
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page).locator(".insp-col")).toHaveValue("1");
  });
});
