import type { Page } from "@playwright/test";

/**
 * The toolbar's menus (spec: docs/specs/toolbar.md): text styles and
 * inserts live in dropdowns, so a test opens the menu first - as a
 * user does.
 */

/** Text style menu: "p", "h1", "h2" or "h3". */
export async function pickStyle(page: Page, block: string): Promise<void> {
  await page.locator("#btn-style-menu").click();
  await page.locator(`#style-menu button[data-block="${block}"]`).click();
}

/** Insert menu: an item by its button id ("btn-table"). */
export async function insertFrom(page: Page, id: string): Promise<void> {
  await page.locator("#btn-insert-menu").click();
  await page.locator(`#insert-menu #${id}`).click();
}
