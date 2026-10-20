import { expect, test } from "@playwright/test";

/**
 * Dark and light mode (spec: docs/specs/dark-light-mode.md): the
 * app chrome dresses from CSS variables - the DOCUMENT stays
 * paper (its look comes from its own theme). The toggle button
 * and the palette entry both flip the persisted choice; the
 * <head> script sets the attribute before first paint so a saved
 * dark choice survives a reload.
 */

test.describe("dark/light mode", () => {
  test("defaults to light and the button switches to dark", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    expect(await page.locator("html").getAttribute("data-mode")).toBe("light");
    // The toolbar's surface visibly changes: assert a token color.
    const header = page.locator("header");
    const lightBg = await header.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await expect(page.locator("#btn-mode")).toHaveAttribute(
      "title",
      "Switch to dark mode",
    );
    await page.locator("#btn-mode").click();
    expect(await page.locator("html").getAttribute("data-mode")).toBe("dark");
    const darkBg = await header.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(darkBg).not.toBe(lightBg);
    await expect(page.locator("#btn-mode")).toHaveAttribute(
      "title",
      "Switch to light mode",
    );
  });

  test("the choice persists across reloads", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btn-mode").click();
    expect(await page.locator("html").getAttribute("data-mode")).toBe("dark");
    await page.reload();
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    // The head script restores the attribute before first paint.
    expect(await page.locator("html").getAttribute("data-mode")).toBe("dark");
    await page.locator("#btn-mode").click();
    expect(await page.locator("html").getAttribute("data-mode")).toBe("light");
    await page.reload();
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    expect(await page.locator("html").getAttribute("data-mode")).toBe("light");
  });

  test("the palette entry flips the mode too", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    await page.keyboard.press("Control+k");
    await page
      .locator("#palette-list .palette-item", {
        hasText: "Toggle dark mode",
      })
      .first()
      .click();
    expect(await page.locator("html").getAttribute("data-mode")).toBe("dark");
  });

  test("the document stays paper in dark mode", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btn-mode").click();
    // The rendered document keeps its own light paper - the app
    // dims around it, the document does not.
    const article = page.locator("folio-doc article").first();
    const docBg = await article.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(docBg).toBe("rgb(255, 255, 255)"); // the paper it owns
  });
});
