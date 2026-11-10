import { expect, test } from "@playwright/test";

/**
 * Select-column chips, date/datetime cell pickers, and cross-filtering
 * (specs: docs/specs/select-columns.md, date-column-controls.md,
 * cross-filtering.md), exercised on the project-plan example.
 */

test.describe("cell controls and cross-filtering", () => {
  test("select cells render as chips; clicking opens a dropdown and commits", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    await fig.scrollIntoViewIfNeeded();
    // status column (index 1) cells are chips
    const chips = fig.locator("tbody td[data-col-index='1'] .folio-chip");
    await expect(chips).toHaveCount(4);
    await expect(chips.first()).toHaveText("doing");
    // click the first status cell -> dropdown with the options
    await fig
      .locator("tbody td[data-row-index='0'][data-col-index='1']")
      .click();
    const pop = fig.locator(".folio-cell-pop select");
    await expect(pop).toBeVisible();
    await expect(pop.locator("option")).toHaveCount(4); // blank + 3 options
    // The pop must survive the dropdown taking focus (blur): it
    // closes on outside click, not blur.
    await pop.evaluate((el) => (el as HTMLElement).blur());
    await expect(pop).toBeVisible();
    await pop.selectOption("done");
    await expect(
      fig.locator(
        "tbody td[data-row-index='0'][data-col-index='1'] .folio-chip",
      ),
    ).toHaveText("done");
    // model write: the markdown source has it
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      '["Chip rendering in tables", done',
    );
    await page.locator("#btn-view").click();
  });

  test("date cell opens a date picker and commits ISO", async ({ page }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    await fig.scrollIntoViewIfNeeded();
    const cell = fig.locator(
      "tbody td[data-row-index='0'][data-col-index='3']",
    );
    await expect(cell).toHaveText("2026-11-11");
    // the calendar icon opens the picker; the cell itself stays
    // text-editable (type the ISO value)
    await cell.hover();
    await cell.locator(".folio-date-btn").click();
    const input = fig.locator(".folio-cell-pop input[type='date']");
    await expect(input).toBeVisible();
    // Blur (the picker taking focus) must not close the pop.
    await input.evaluate((el) => (el as HTMLElement).blur());
    await expect(input).toBeVisible();
    await input.fill("2026-11-20");
    await page.keyboard.press("Enter"); // commits via the change handler
    await expect(cell).toHaveText(/2026-11-20/);
  });

  test("dataset browser: chips, dropdown, and date picker work in the sheet", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    await fig.scrollIntoViewIfNeeded();
    // open the sheet from the table's inspector bar
    await fig
      .locator("tbody td[data-row-index='0'][data-col-index='0']")
      .click();
    await fig.locator(".insp-dataset").click();
    const sheet = page.locator(".folio-ds-overlay");
    await expect(sheet).toBeVisible();
    // select cells render as chips in the sheet too
    const chips = sheet.locator(
      ".folio-ds-row .folio-ds-cell[data-col='1'] .folio-chip",
    );
    await expect(chips).toHaveCount(4);
    await expect(chips.first()).toHaveText("doing");
    // click a status cell -> dropdown inside the sheet
    await sheet
      .locator(".folio-ds-row[data-display='0'] .folio-ds-cell[data-col='1']")
      .click();
    const pop = sheet.locator(".folio-cell-pop select");
    await expect(pop).toBeVisible();
    await pop.selectOption("done");
    await expect(
      sheet.locator(
        ".folio-ds-row[data-display='0'] .folio-ds-cell[data-col='1'] .folio-chip",
      ),
    ).toHaveText("done");
    // the in-document figure updated too (one model write)
    await expect(
      fig.locator(
        "tbody td[data-row-index='0'][data-col-index='1'] .folio-chip",
      ),
    ).toHaveText("done");
    // a date cell's calendar icon opens the picker in the sheet
    const dateCell = sheet.locator(
      ".folio-ds-row[data-display='0'] .folio-ds-cell[data-col='3']",
    );
    await expect(dateCell).toContainText("2026-11-11");
    await dateCell.hover();
    await dateCell.locator(".folio-date-btn").click();
    const input = sheet.locator(".folio-cell-pop input[type='date']");
    await expect(input).toBeVisible();
    await input.fill("2026-11-20");
    await page.keyboard.press("Enter"); // commits via the change handler
    await expect(
      sheet.locator(
        ".folio-ds-row[data-display='0'] .folio-ds-cell[data-col='3']",
      ),
    ).toContainText("2026-11-20");
    // model write: close the sheet, the markdown source has both edits
    await page.locator(".folio-ds-done").click();
    await expect(sheet).toBeHidden();
    await page.locator("#btn-markdown").click();
    const src = await page.locator("#editor").inputValue();
    expect(src).toContain('["Chip rendering in tables", done');
    expect(src).toContain("2026-11-20");
    await page.locator("#btn-view").click();
  });

  test("totals row sums effort", async ({ page }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    const foot = fig.locator("tfoot tr.folio-totals");
    await expect(foot.locator("td").first()).toHaveText("Total");
    await expect(foot.locator("td[data-col-index='4']")).toHaveText("8");
  });

  test("cross-filter: click a bar, linked charts filter, chip clears", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const byStatus = page.locator('#the-doc figure[data-chart-id="by-status"]');
    const byOwner = page.locator('#the-doc figure[data-chart-id="by-owner"]');
    await byStatus.scrollIntoViewIfNeeded();
    // grouped query, two series -> 2 rects per category
    await expect(
      byStatus.locator("svg[role='img'] rect[data-cat]"),
    ).toHaveCount(6);
    const ownerBarsBefore = await byOwner
      .locator("svg[role='img'] rect[data-cat]")
      .count();
    // click the "doing" bar in by-status
    await byStatus
      .locator("svg[role='img'] rect[data-cat='doing']")
      .first()
      .click();
    // a chip appears on both linked charts
    await expect(byStatus.locator(".xf-chip")).toHaveText(/status = doing/);
    await expect(byOwner.locator(".xf-chip")).toHaveText(/status = doing/);
    // the owner chart filtered: only Nick's row remains (1 task doing)
    await expect(byOwner.locator("svg[role='img'] rect[data-cat]")).toHaveCount(
      1,
    );
    expect(ownerBarsBefore).toBe(3);
    // the clicked chart filtered too: only the "doing" bars remain
    await expect(
      byStatus.locator("svg[role='img'] rect[data-cat='doing']"),
    ).toHaveCount(2);
    await expect(
      byStatus.locator("svg[role='img'] rect[data-cat='todo']"),
    ).toHaveCount(0);
    // clear via the chip's x
    await byOwner.locator(".xf-chip").click();
    await expect(byOwner.locator("svg[role='img'] rect[data-cat]")).toHaveCount(
      3,
    );
    await expect(byStatus.locator(".xf-chip")).toHaveCount(0);
  });
});
