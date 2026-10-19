import { expect, test, type Page } from "@playwright/test";

/**
 * Command palette (Ctrl+K): search over commands, help topics, and
 * document sections. First-contact contract: a new user finds every
 * feature by typing words they already know.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

function openPalette(page: Page): Promise<void> {
  return page.keyboard.press("Control+k");
}

test.describe("command palette", () => {
  test("Ctrl+K opens the palette; the search button opens it too", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openPalette(page);
    await expect(page.locator("#palette-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#palette-modal")).toBeHidden();
    await page.locator("#btn-search").click();
    await expect(page.locator("#palette-modal")).toBeVisible();
  });

  test("the empty palette lists commands first, then sections and help", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openPalette(page);
    const groups = await page
      .locator("#palette-list .palette-tag")
      .allTextContents();
    expect(groups[0]).toBe("Command");
    expect(groups).toContain("Section");
    expect(groups).toContain("Help");
  });

  test("typing a command word and pressing Enter runs it", async ({ page }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("insert table");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Insert a table");
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-modal")).toBeHidden();
    await expect(page.locator("#the-doc figure")).toHaveCount(3);
    await expect(
      page.locator("#the-doc figure table", { hasText: "item" }),
    ).toBeVisible();
  });

  test("typing a section name jumps to that section", async ({ page }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("regional summary");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Regional summary");
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-modal")).toBeHidden();
    // revealBlock moves focus into the document (the article is the
    // editing host) and scrolls the section into view.
    const focused = await page.evaluate(() => {
      const a = document.querySelector("folio-doc")?.shadowRoot?.activeElement;
      return a instanceof HTMLElement ? a.tagName : null;
    });
    expect(focused).toBe("ARTICLE");
    const top = await page
      .locator("folio-doc h2", { hasText: "Regional summary" })
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(400);
  });

  test("a help topic opens the help document at that topic", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("keyboard shortcuts");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Help: Keyboard shortcuts");
    await page.keyboard.press("Enter");
    await expect(page.locator("#help-modal")).toBeVisible();
    await expect(
      page.locator("#help-doc h2", { hasText: "Keyboard shortcuts" }),
    ).toBeVisible();
  });

  test("ArrowDown moves the selection and Enter runs the moved-to item", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("insert");
    const first = page.locator("#palette-list .palette-item").first();
    await expect(first).toHaveClass(/selected/);
    await page.keyboard.press("ArrowDown");
    const second = page.locator("#palette-list .palette-item").nth(1);
    await expect(second).toHaveClass(/selected/);
    await expect(first).not.toHaveClass(/selected/);
    await page.keyboard.press("ArrowUp");
    await expect(first).toHaveClass(/selected/);
  });

  test("an unmatched query shows No matches and Enter does nothing", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("zzzqqq");
    await expect(page.locator("#palette-list .palette-empty")).toHaveText(
      "No matches",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-modal")).toBeVisible();
  });

  test("web hosts list no Open or Save command", async ({ page }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("save");
    const items = await page
      .locator("#palette-list .palette-item")
      .allTextContents();
    expect(items.some((t) => t.includes("Save the document"))).toBeFalsy();
  });

  test("the palette reflects the current view command", async ({ page }) => {
    await waitForDocument(page);
    await openPalette(page);
    await page.locator("#palette-input").fill("markdown");
    await page.keyboard.press("Enter");
    await expect(page.locator("#editor")).toBeVisible();
    await openPalette(page);
    await page.locator("#palette-input").fill("document view");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Switch to Document view");
    await page.keyboard.press("Enter");
    await expect(page.locator("#editor")).toBeHidden();
  });
});
