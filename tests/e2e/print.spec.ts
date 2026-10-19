import { expect, test, type Page } from "@playwright/test";

/**
 * Print / PDF: one pipeline - the OS print dialog (which exports
 * PDF everywhere) over a print stylesheet that shows the document,
 * not the app chrome.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

test.describe("print and PDF", () => {
  test("print media hides the app chrome and shows the document", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("header")).toBeHidden();
    await expect(page.locator("#sidebar")).toBeHidden();
    await expect(page.locator("#status")).toBeHidden();
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await expect(page.locator("header")).toBeVisible();
  });

  test("printing from the Markdown view switches to the document first", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(page.locator("#editor")).toBeHidden();
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
  });

  test("printing closes an open help window", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await expect(page.locator("#help-modal")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(page.locator("#help-modal")).toBeHidden();
  });

  test("the palette print command calls window.print", async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => {
        (window as unknown as { __printed: number }).__printed =
          ((window as unknown as { __printed?: number }).__printed ?? 0) + 1;
      };
    });
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("print");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Print the document");
    await page.keyboard.press("Enter");
    const printed = await page.evaluate(
      () => (window as unknown as { __printed?: number }).__printed,
    );
    expect(printed).toBe(1);
  });

  test("the H2 page-break setting applies in print media", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-pb-h2").selectOption("before");
    await page.locator("#settings-form button[type=submit]").click();
    await page.emulateMedia({ media: "print" });
    const breakBefore = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const h2 = root?.querySelector("h2");
      return h2 ? getComputedStyle(h2).breakBefore : null;
    });
    expect(breakBefore).toBe("page");
    await page.emulateMedia({ media: "screen" });
    const screenBreak = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const h2 = root?.querySelector("h2");
      return h2 ? getComputedStyle(h2).breakBefore : null;
    });
    expect(screenBreak).not.toBe("page");
  });
});
