import { expect, test, type Page } from "@playwright/test";

/**
 * Unsaved changes (spec: docs/specs/unsaved-changes.md): replacing
 * an edited document asks first - Save (desktop), Discard changes, or
 * Cancel. A clean document (or one undone back to clean) never asks.
 */

// An example, not the guide: the guide is a playground whose edits
// never count as unsaved work.
async function editExample(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  const p = page.locator("#the-doc article > p").first();
  await p.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" EDITED");
  await expect(p).toContainText("EDITED");
}

const modal = (page: Page) => page.locator("#unsaved-modal");

test.describe("unsaved changes", () => {
  test("a clean document opens another without asking", async ({ page }) => {
    await page.goto("/");
    await page.locator("#the-doc a", { hasText: "A pure-prose poem" }).click();
    await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
    await expect(modal(page)).toBeHidden();
  });

  test("an edited document asks; Cancel keeps it and its address", async ({
    page,
  }) => {
    await editExample(page);
    const url = page.url();
    await page.locator("#the-doc a", { hasText: "A pure-prose poem" }).click();
    await expect(modal(page)).toBeVisible();
    // The web has no Save: only Discard / Cancel.
    await expect(page.locator("#btn-unsaved-save")).toBeHidden();
    await page.locator("#btn-unsaved-cancel").click();
    await expect(modal(page)).toBeHidden();
    await expect(page.locator("#the-doc article > p").first()).toContainText(
      "EDITED",
    );
    expect(page.url()).toBe(url);
  });

  test("Discard changes goes ahead", async ({ page }) => {
    await editExample(page);
    await page.locator("#btn-home").click();
    await expect(modal(page)).toBeVisible();
    await page.locator("#btn-unsaved-discard").click();
    await expect(
      page.locator("#the-doc article > p").first(),
    ).not.toContainText("EDITED");
  });

  test("undoing back to the original counts as clean", async ({ page }) => {
    await editExample(page);
    await page.keyboard.press("Control+z");
    await expect(
      page.locator("#the-doc article > p").first(),
    ).not.toContainText("EDITED");
    await page.locator("#the-doc a", { hasText: "A pure-prose poem" }).click();
    await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
    await expect(modal(page)).toBeHidden();
  });

  test("Back asks too; Cancel keeps the document and the address", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#the-doc a", { hasText: "A pure-prose poem" }).click();
    await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
    const p = page.locator("#the-doc article > p").first();
    await p.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" EDITED");
    const url = page.url();
    await page.goBack();
    await expect(modal(page)).toBeVisible();
    await page.locator("#btn-unsaved-cancel").click();
    await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
    await expect.poll(() => page.url()).toBe(url);
  });

  test("the palette's Open example asks too", async ({ page }) => {
    await editExample(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("open example poem");
    await page.keyboard.press("Enter");
    await expect(modal(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#the-doc article > p").first()).toContainText(
      "EDITED",
    );
  });

  test("closing or reloading an edited tab gets the browser's prompt", async ({
    page,
  }) => {
    await editExample(page);
    const prompted = new Promise<string>((resolve) => {
      page.once("dialog", (d) => {
        resolve(d.type());
        void d.dismiss();
      });
    });
    void page.reload().catch(() => undefined);
    expect(await prompted).toBe("beforeunload");
  });
});
