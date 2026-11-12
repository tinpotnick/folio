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
    // click the first status cell -> the chip itself becomes the
    // dropdown: a styled <select> in the cell, no separate pop
    const cell = fig.locator(
      "tbody td[data-row-index='0'][data-col-index='1']",
    );
    await cell.click();
    const sel = cell.locator("select.folio-chip-select");
    await expect(sel).toBeVisible();
    // the chip span is replaced by the select (which wears the class)
    await expect(cell.locator("span.folio-chip")).toHaveCount(0);
    await expect(sel.locator("option")).toHaveCount(4); // blank + 3 options
    // The select must survive the dropdown taking focus (blur): it
    // closes on outside click, not blur.
    await sel.evaluate((el) => (el as HTMLElement).blur());
    await expect(sel).toBeVisible();
    await sel.selectOption("done");
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

  test("date cell opens an in-cell calendar and commits ISO", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    await fig.scrollIntoViewIfNeeded();
    const cell = fig.locator(
      "tbody td[data-row-index='0'][data-col-index='3']",
    );
    await expect(cell).toHaveText("2026-11-11");
    // the calendar icon opens folio's own month-grid calendar at the
    // cell (no native-picker dependency); the cell body stays
    // text-editable (type the ISO value)
    await cell.hover();
    await cell.locator(".folio-date-btn").click();
    const cal = cell.locator(".folio-cal-pop");
    await expect(cal).toBeVisible();
    await expect(fig.locator(".folio-cell-pop")).toHaveCount(0);
    // the current value's month, with the 11th selected
    await expect(cal.locator(".folio-cal-title")).toContainText(
      "November 2026",
    );
    await expect(cal.locator(".folio-cal-day.selected")).toHaveText("11");
    // month navigation
    await cal.locator(".folio-cal-nav").nth(1).click();
    await expect(cal.locator(".folio-cal-title")).toContainText(
      "December 2026",
    );
    await cal.locator(".folio-cal-nav").nth(0).click();
    await expect(cal.locator(".folio-cal-title")).toContainText(
      "November 2026",
    );
    // blur must not close the calendar (it closes on outside click)
    await cal.evaluate((el) => (el as HTMLElement).blur());
    await expect(cal).toBeVisible();
    // pick the 20th -> commits immediately and closes
    await cal.locator(".folio-cal-day", { hasText: /^20$/ }).click();
    await expect(cell).toHaveText(/2026-11-20/);
    await expect(fig.locator(".folio-cal-pop")).toHaveCount(0);
  });

  test("datetime column: calendar plus time field commit a datetime", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
    await page.goto("/");
    await page.locator("folio-doc h1").first().waitFor();
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill(
        "# T\n\n::: table {#ev}\ncolumns:\n  - {name: what, type: text}\n  - {name: at, type: datetime}\ndata:\n  - [standup, 2026-11-12T09:30]\n:::\n",
      );
    await page.locator("#btn-view").click();
    await page.locator("#the-doc h1").first().waitFor();
    const fig = page.locator('#the-doc figure[data-table-id="ev"]');
    const cell = fig.locator(
      "tbody td[data-row-index='0'][data-col-index='1']",
    );
    await cell.hover();
    await cell.locator(".folio-date-btn").click();
    const cal = cell.locator(".folio-cal-pop");
    await expect(cal).toBeVisible();
    await expect(cal.locator(".folio-cal-day.selected")).toHaveText("12");
    const time = cal.locator("input[type='time']");
    await expect(time).toHaveValue("09:30");
    // pick another day; the time field rides along
    await cal.locator(".folio-cal-day", { hasText: /^20$/ }).click();
    await expect(cell).toHaveText(/2026-11-20T09:30/);
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
    // click a status cell -> the chip itself becomes the dropdown
    const statusCell = sheet.locator(
      ".folio-ds-row[data-display='0'] .folio-ds-cell[data-col='1']",
    );
    await statusCell.click();
    const sel = statusCell.locator("select.folio-chip-select");
    await expect(sel).toBeVisible();
    await expect(statusCell.locator("span.folio-chip")).toHaveCount(0);
    await sel.selectOption("done");
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
    const cal = dateCell.locator(".folio-cal-pop");
    await expect(cal).toBeVisible();
    await expect(sheet.locator(".folio-cell-pop")).toHaveCount(0);
    await cal.locator(".folio-cal-day", { hasText: /^20$/ }).click();
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

  test("inspector bar never overflows the figure or page, even with the select-column options open", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    await fig.scrollIntoViewIfNeeded();
    // clicking a status chip opens the chip-dropdown AND selects the
    // column in the inspector, revealing the options + multi controls
    await fig
      .locator("tbody td[data-row-index='0'][data-col-index='1']")
      .click();
    await expect(fig.locator("> .folio-inspector")).toBeVisible();
    await expect(
      fig.locator(".folio-inspector .insp-select-opts"),
    ).toBeVisible();
    const noOverflow = async (): Promise<void> => {
      const bar = await fig.locator("> .folio-inspector").evaluate((el) => ({
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
      }));
      expect(bar.scrollW).toBeLessThanOrEqual(bar.clientW);
      const f = await fig.evaluate((el) => ({
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
      }));
      expect(f.scrollW).toBeLessThanOrEqual(f.clientW);
      const doc = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(doc.scrollW).toBeLessThanOrEqual(doc.clientW);
    };
    await noOverflow();
    // narrow viewport: still no horizontal page overflow
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(200);
    await noOverflow();
  });

  test("calendar pop flips up to stay inside the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto("/?doc=demo/examples/project-plan.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="plan"]');
    // put a bottom-row date cell at the bottom edge of a short viewport
    const cell = fig.locator(
      "tbody td[data-row-index='3'][data-col-index='3']",
    );
    await cell.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(200);
    await cell.hover();
    await cell.locator(".folio-date-btn").click();
    const cal = cell.locator(".folio-cal-pop");
    await expect(cal).toBeVisible();
    const cb = await cal.boundingBox();
    const cellb = await cell.boundingBox();
    expect(cb).not.toBeNull();
    expect(cellb).not.toBeNull();
    if (!cb || !cellb) return;
    // fully inside the viewport, and flipped above the cell
    expect(cb.y).toBeGreaterThanOrEqual(7);
    expect(cb.y + cb.height).toBeLessThanOrEqual(420 - 7);
    expect(cb.y + cb.height).toBeLessThanOrEqual(cellb.y + 2);
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
