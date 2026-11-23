import { expect, test, type Page } from "@playwright/test";

/** The general context menu (spec: docs/specs/context-menu.md). */

async function load(page: Page, md: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("folio.guided", "1");
    localStorage.setItem("folio-comment-author", "nick");
  });
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  await page.locator("#editor").fill(md);
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-view")?.click(),
  );
  await page.locator("#the-doc h1").first().waitFor();
}

/** Right-click inside the document at the given element. */
async function rightClick(page: Page, sel: string): Promise<void> {
  await page.locator(sel).first().dispatchEvent("contextmenu", {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: 120,
    clientY: 120,
  });
}

test.describe("general context menu", () => {
  test("right-click in prose opens the document menu with the usual candidates + comment", async ({
    page,
  }) => {
    await load(page, "# T\n\nSome words to click on.\n");
    await rightClick(page, "#the-doc p");
    const menu = page.locator("#the-doc .folio-doc-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator("button", { hasText: "Cut" })).toBeDisabled();
    await expect(menu.locator("button", { hasText: "Copy" })).toBeDisabled();
    await expect(menu.locator("button", { hasText: "Paste" })).toBeEnabled();
    await expect(
      menu.locator("button", { hasText: "Select all" }),
    ).toBeEnabled();
    await expect(
      menu.locator("button", { hasText: "Add comment" }),
    ).toBeEnabled();
    // Esc closes it.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("Add comment from the menu quotes the selection", async ({ page }) => {
    await load(page, "# T\n\nSome words to click on.\n");
    const p = page.locator("#the-doc p", { hasText: "Some words" });
    await p.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await rightClick(page, "#the-doc p");
    await page
      .locator("#the-doc .folio-doc-menu button", { hasText: "Add comment" })
      .click();
    await expect(page.locator("#the-doc .folio-doc-menu")).toBeHidden();
    const aside = page.locator("#the-doc aside.folio-comment");
    await expect(aside).toHaveCount(1);
    await expect(aside.locator(".folio-comment-quote")).toHaveText(
      "Some words to click on.",
    );
    await expect(page.locator("#the-doc mark.folio-comment-mark")).toHaveText(
      "Some words to click on.",
    );
  });

  test("Cut and Copy enable with a selection; an outside click closes the menu", async ({
    page,
  }) => {
    await load(page, "# T\n\nSome words to click on.\n");
    const p = page.locator("#the-doc p", { hasText: "Some words" });
    await p.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await rightClick(page, "#the-doc p");
    const menu = page.locator("#the-doc .folio-doc-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator("button", { hasText: "Cut" })).toBeEnabled();
    await expect(menu.locator("button", { hasText: "Copy" })).toBeEnabled();
    // Click outside the menu closes it.
    await page.mouse.click(600, 500);
    await expect(menu).toBeHidden();
  });

  test("Insert menu has Comment and it runs the same action", async ({
    page,
  }) => {
    await load(page, "# T\n\nSome words to click on.\n");
    await page.locator("#the-doc p", { hasText: "Some words" }).click();
    await page.locator("#btn-insert-menu").click();
    await page
      .locator('#insert-menu button[data-insert="Add a comment"]')
      .click();
    await expect(page.locator("#the-doc aside.folio-comment")).toHaveCount(1);
  });
});
