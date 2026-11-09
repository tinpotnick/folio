import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The table context menu (spec: docs/specs/table-context-menu.md):
 * a Word/Excel-shaped menu over a cell - clipboard, insert, delete
 * and organize groups with icons, separators, shortcut hints and
 * disabled states with reasons - opened by right-click or Shift+F10.
 * Every item is also a palette command (Ctrl+K) acting on the caret.
 */

async function open(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

function fig(page: Page) {
  return page.locator('#the-doc figure[data-table-id="regional-data"]');
}

function menu(page: Page) {
  return page.locator(".folio-menu.folio-table-menu");
}

function item(page: Page, label: string) {
  return menu(page).locator("button", { hasText: label });
}

/** Open the context menu on a cell deterministically: after a
 * structural edit the bar-reveal scroll can shift what a real
 * right-click lands on, so later openings dispatch the event on the
 * exact cell (the handler path is the same). */
async function openMenuAt(page: Page, cell: Locator): Promise<void> {
  const box = await cell.boundingBox();
  await cell.dispatchEvent("contextmenu", {
    button: 2,
    clientX: box ? box.x + box.width / 2 : 100,
    clientY: box ? box.y + box.height / 2 : 100,
  });
  await expect(menu(page)).toBeVisible();
}

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
  return md;
}

test.describe("table context menu", () => {
  test("right-click opens the grouped menu: icons, hints, separators, enabled states", async ({
    page,
  }) => {
    await open(page);
    await fig(page)
      .locator('td[data-row-index="0"][data-col-index="1"]')
      .click({ button: "right" });
    await expect(menu(page)).toBeVisible();
    for (const label of [
      "Open the dataset",
      "Cut",
      "Copy",
      "Paste",
      "Insert row above",
      "Insert row below",
      "Insert column left",
      "Insert column right",
      "Delete row",
      "Delete column",
      "Clear contents",
      "Sort ascending",
      "Sort descending",
      "Hide column",
    ]) {
      await expect(item(page, label)).toBeVisible();
    }
    // The top item is Open the dataset; five groups, four
    // separators; clipboard rows carry their shortcut as a kbd chip;
    // every row has an icon.
    await expect(menu(page).locator("button").first()).toHaveText(
      /Open the dataset/,
    );
    await expect(menu(page).locator(".menu-sep")).toHaveCount(4);
    await expect(item(page, "Cut").locator(".menu-kbd")).toHaveText("Ctrl+X");
    await expect(item(page, "Copy").locator(".menu-kbd")).toHaveText("Ctrl+C");
    await expect(item(page, "Paste").locator(".menu-kbd")).toHaveText("Ctrl+V");
    await expect(menu(page).locator("button:not(:disabled) svg")).toHaveCount(
      14,
    );
    // A data cell is editable: cut/paste/clear enabled.
    await expect(item(page, "Cut")).toBeEnabled();
    await expect(item(page, "Paste")).toBeEnabled();
    await expect(item(page, "Clear contents")).toBeEnabled();
    // The menu fits the window it opened in.
    const box = await menu(page).boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        await page.evaluate(() => window.innerWidth),
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        await page.evaluate(() => window.innerHeight),
      );
    }
  });

  test("a formula column disables delete/cut/paste/clear, with the reason in the tooltip", async ({
    page,
  }) => {
    await open(page);
    await fig(page)
      .locator('td[data-row-index="0"][data-col-index="3"]')
      .click({ button: "right" });
    await expect(item(page, "Delete column")).toBeDisabled();
    await expect(item(page, "Delete column")).toHaveAttribute(
      "title",
      /formula/,
    );
    await expect(item(page, "Cut")).toBeDisabled();
    await expect(item(page, "Paste")).toBeDisabled();
    await expect(item(page, "Clear contents")).toBeDisabled();
    await expect(item(page, "Sort ascending")).toBeEnabled();
    await expect(item(page, "Hide column")).toBeEnabled();
    // Copy still works - it copies the computed value.
    await expect(item(page, "Copy")).toBeEnabled();
  });

  test("a simple table's column cannot be hidden", async ({ page }) => {
    await page.goto("/");
    await page.locator("folio-doc h1").first().waitFor();
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill(
        "# T\n\n| Fruit | Price |\n| ----- | ----- |\n| Apple | 1.20 |\n| Pear | 0.90 |\n",
      );
    await page.locator("#btn-view").click();
    await page.locator("#the-doc h1").first().waitFor();
    const fig = page.locator('#the-doc figure[data-table-kind="table"]');
    await fig.locator("tbody td").first().click({ button: "right" });
    await expect(item(page, "Hide column")).toBeDisabled();
    await expect(item(page, "Hide column")).toHaveAttribute(
      "title",
      /simple table/,
    );
    // ...and so is Open the dataset.
    await expect(item(page, "Open the dataset")).toBeDisabled();
    await expect(item(page, "Open the dataset")).toHaveAttribute(
      "title",
      /simple table/,
    );
  });

  test("the top item, Open the dataset, opens the full-window browser", async ({
    page,
  }) => {
    await open(page);
    await openMenuAt(
      page,
      fig(page).locator('td[data-row-index="0"][data-col-index="0"]'),
    );
    await item(page, "Open the dataset").click();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.locator(".folio-ds-overlay")).toBeVisible();
    await expect(page.locator(".folio-ds-title")).toHaveText("@regional-data");
    await page.keyboard.press("Escape");
    await expect(page.locator(".folio-ds-overlay")).toBeHidden();
    // The palette entry opens the same browser from a cell.
    await fig(page)
      .locator('td[data-row-index="1"][data-col-index="0"]')
      .click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("open the dataset browser");
    await page.keyboard.press("Enter");
    await expect(page.locator(".folio-ds-overlay")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".folio-ds-overlay")).toBeHidden();
  });

  test("insert row above/below and column left/right, then delete the row", async ({
    page,
  }) => {
    await open(page);
    const rows = fig(page).locator("tbody tr");
    const cell = (r: number, c: number) =>
      fig(page).locator(
        `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
      );
    const before = await rows.count();
    // Insert row above row 1: a blank row lands at index 1.
    await openMenuAt(page, cell(1, 0));
    await item(page, "Insert row above").click();
    await expect(rows).toHaveCount(before + 1);
    await expect(rows.nth(1).locator("td").first()).toHaveText("");
    // Insert column left of q2: named "new".
    const headers = fig(page).locator("thead th");
    const cols = await headers.count();
    await openMenuAt(page, cell(0, 1));
    await item(page, "Insert column left").click();
    await expect(headers).toHaveCount(cols + 1);
    await expect(headers.nth(1)).toContainText("new");
    // Insert row below row 0, then delete row 0: the blank row left.
    await openMenuAt(page, cell(0, 0));
    await item(page, "Insert row below").click();
    await expect(rows).toHaveCount(before + 2);
    await openMenuAt(page, cell(0, 0));
    await item(page, "Delete row").click();
    await expect(rows).toHaveCount(before + 1);
    // The deleted row was row 0 (North): the first row is now blank.
    await expect(rows.first().locator("td").first()).toHaveText("");
    const md = await source(page);
    expect(md).toContain('- [South, "", 388, 394]');
    expect(md).not.toContain("[North,");
  });

  test("sort ascending reorders rows and reaches the source; sort descending on the formula column computes", async ({
    page,
  }) => {
    await open(page);
    const firstRegion = () =>
      fig(page).locator('tbody tr td[data-col-index="0"]').first();
    const cell = (r: number, c: number) =>
      fig(page).locator(
        `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
      );
    // Sort by q2 (col 1) ascending: Midlands (301), South (388), North (412).
    await openMenuAt(page, cell(0, 1));
    await item(page, "Sort ascending").click();
    await expect(firstRegion()).toHaveText("Midlands");
    let md = await source(page);
    expect(md.indexOf("[Midlands, 301, 355]")).toBeLessThan(
      md.indexOf("[North, 412, 501]"),
    );
    // Sort by the formula column growth (col 3), descending:
    // North 21.6%, Midlands 17.9%, South 1.5%.
    await openMenuAt(page, cell(0, 3));
    await item(page, "Sort descending").click();
    await expect(firstRegion()).toHaveText("North");
    md = await source(page);
    expect(md.indexOf("[North, 412, 501]")).toBeLessThan(
      md.indexOf("[South, 388, 394]"),
    );
  });

  test("hide column removes it from the figure and marks it hidden in the source", async ({
    page,
  }) => {
    await open(page);
    const headers = fig(page).locator("thead th");
    const before = await headers.count();
    await openMenuAt(
      page,
      fig(page).locator('td[data-row-index="0"][data-col-index="1"]'),
    );
    await item(page, "Hide column").click();
    await expect(headers).toHaveCount(before - 1);
    await expect(fig(page).locator("thead th", { hasText: "q2" })).toHaveCount(
      0,
    );
    // The column stays in the data; the bar's picker marks it.
    await expect(fig(page).locator(".folio-inspector")).toBeVisible();
    await expect(
      fig(page).locator(".insp-col option", { hasText: "q2 (hidden)" }),
    ).toHaveCount(1);
    const md = await source(page);
    expect(md).toContain("hidden: true");
    // ...and the menu still offers hide on another column.
    await openMenuAt(page, fig(page).locator('th[data-col-index="0"]'));
    await expect(item(page, "Hide column")).toBeEnabled();
  });

  test("copy, paste, cut and clear on data cells", async ({ page }) => {
    await open(page);
    const cell = (r: number, c: number) =>
      fig(page).locator(
        `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
      );
    // Copy q2 of North (412), paste into Midlands (row 2, col 1).
    await openMenuAt(page, cell(0, 1));
    await item(page, "Copy").click();
    await openMenuAt(page, cell(2, 1));
    await item(page, "Paste").click();
    await expect(cell(2, 1)).toHaveText("412");
    // Cut South's q2 (row 1 col 1 = 388) -> the cell empties.
    await openMenuAt(page, cell(1, 1));
    await item(page, "Cut").click();
    await expect(cell(1, 1)).toHaveText("");
    // Paste it into row 0 col 1.
    await openMenuAt(page, cell(0, 1));
    await item(page, "Paste").click();
    await expect(cell(0, 1)).toHaveText("388");
    // Clear contents empties a text cell.
    await openMenuAt(page, cell(0, 0));
    await item(page, "Clear contents").click();
    await expect(cell(0, 0)).toHaveText("");
    const md = await source(page);
    expect(md).toContain('- ["", 388, 501]');
    expect(md).toContain('- [South, "", 394]');
    expect(md).toContain("- [Midlands, 412, 355]");
  });

  test("copy on a formula cell copies the computed value", async ({ page }) => {
    await open(page);
    const cell = (r: number, c: number) =>
      fig(page).locator(
        `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
      );
    // North's growth computes to (501-412)/412 = 21.6%.
    await openMenuAt(page, cell(0, 3));
    await item(page, "Copy").click();
    await openMenuAt(page, cell(2, 0));
    await item(page, "Paste").click();
    // Pasted into a text cell as the computed number (0.216...).
    await expect(cell(2, 0)).toContainText("0.216");
  });

  test("Shift+F10 opens the menu at the caret's cell; Esc and outside clicks close it", async ({
    page,
  }) => {
    await open(page);
    await fig(page)
      .locator('td[data-row-index="0"][data-col-index="0"]')
      .click();
    await page.keyboard.press("Shift+F10");
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    // Reopen (re-click for a fresh caret), then click elsewhere: the
    // once-pointerdown closer fires.
    await fig(page)
      .locator('td[data-row-index="0"][data-col-index="0"]')
      .click();
    await page.keyboard.press("Shift+F10");
    await expect(menu(page)).toBeVisible();
    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await expect(menu(page)).toHaveCount(0);
    // A pick closes the menu and acts.
    await openMenuAt(
      page,
      fig(page).locator('td[data-row-index="2"][data-col-index="0"]'),
    );
    await item(page, "Delete row").click();
    await expect(menu(page)).toHaveCount(0);
    await expect(fig(page).locator("tbody tr")).toHaveCount(2);
  });

  test("the palette runs the same actions on the caret's cell", async ({
    page,
  }) => {
    await open(page);
    await fig(page)
      .locator('td[data-row-index="0"][data-col-index="1"]')
      .click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("sort ascending");
    await page.keyboard.press("Enter");
    // The ascending sort runs: Midlands (301) first.
    await expect(
      fig(page).locator('tbody tr td[data-col-index="0"]').first(),
    ).toHaveText("Midlands");
    // And the palette's hide-column entry works too (re-click: the
    // sort re-rendered the table).
    await fig(page)
      .locator('td[data-row-index="0"][data-col-index="1"]')
      .click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("hide the column at the caret");
    await page.keyboard.press("Enter");
    await expect(fig(page).locator("thead th")).toHaveCount(3);
  });
});
