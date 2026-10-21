import { expect, test, type Page } from "@playwright/test";

/**
 * Undo/redo (spec: docs/specs/undo-redo.md): snapshots of the
 * block list at the emitChange chokepoint, grouped into steps -
 * a typing burst is one undo, an insert is one undo, a cell edit
 * is one undo. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, plus the toolbar
 * buttons. A new document clears the history.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function focusIntroEnd(page: Page): Promise<void> {
  await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
}

test.describe("undo/redo", () => {
  test("a typing burst is one undo, and redo restores it", async ({ page }) => {
    await waitForDocument(page);
    await focusIntroEnd(page);
    await page.keyboard.type(" and then some");
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).toContainText("and then some");
    await page.keyboard.press("Control+z");
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).not.toContainText("and then some");
    await page.keyboard.press("Control+Shift+z");
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).toContainText("and then some");
  });

  test("the buttons mirror the history state", async ({ page }) => {
    await waitForDocument(page);
    await expect(page.locator("#btn-undo")).toBeDisabled();
    await expect(page.locator("#btn-redo")).toBeDisabled();
    await focusIntroEnd(page);
    await page.keyboard.type(" more");
    await expect(page.locator("#btn-undo")).toBeEnabled();
    await page.locator("#btn-undo").click();
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).not.toContainText(" more");
    await expect(page.locator("#btn-redo")).toBeEnabled();
    await page.locator("#btn-redo").click();
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).toContainText(" more");
  });

  test("an inserted table is one undo step", async ({ page }) => {
    await waitForDocument(page);
    const before = await page.locator("#the-doc figure").count();
    await focusIntroEnd(page);
    await page.locator("#btn-table").click();
    await expect(page.locator("#the-doc figure")).toHaveCount(before + 1);
    await page.keyboard.press("Control+z");
    await expect(page.locator("#the-doc figure")).toHaveCount(before);
    await page.keyboard.press("Control+y");
    await expect(page.locator("#the-doc figure")).toHaveCount(before + 1);
  });

  test("a cell edit is one undo step", async ({ page }) => {
    await waitForDocument(page);
    const cell = page
      .locator("#the-doc table.folio-table td[data-row-index]")
      .first();
    const original = (await cell.textContent()) ?? "";
    await cell.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("77");
    await page.keyboard.press("Tab");
    await expect(cell).toContainText("77");
    await page.keyboard.press("Control+z");
    await expect(cell).toContainText(original);
  });

  test("removing a figure is undoable", async ({ page }) => {
    await waitForDocument(page);
    const images = page.locator("#the-doc figure.folio-image");
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    await page.locator("#the-doc figure.folio-image img").first().click();
    await page.keyboard.press("Backspace");
    await expect(images).toHaveCount(count - 1);
    await page.keyboard.press("Control+z");
    await expect(images).toHaveCount(count);
  });

  test("a new document clears the history", async ({ page }) => {
    await waitForDocument(page);
    await focusIntroEnd(page);
    await page.keyboard.type(" temp");
    await expect(page.locator("#btn-undo")).toBeEnabled();
    await page.locator("#btn-undo").click();
    // Undoing the only step leaves nothing to undo.
    await expect(page.locator("#btn-undo")).toBeDisabled();
    // Open the poem example - a genuinely new document: the
    // history resets and undo is a no-op.
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("poem");
    await page
      .locator("#palette-list .palette-item", { hasText: "Open example: poem" })
      .first()
      .click();
    await expect(
      page.locator("folio-doc h1", { hasText: "Ozymandias" }),
    ).toBeVisible();
    await expect(page.locator("#btn-undo")).toBeDisabled();
    await page.keyboard.press("Control+z");
    await expect(
      page.locator("folio-doc h1", { hasText: "Ozymandias" }),
    ).toBeVisible();
  });

  test("markdown-view edits are one undo step after a view switch", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    await page
      .locator("#editor")
      .fill(
        md.replace(
          "Revenue recovered after the service outage",
          "REWRITTEN INTRO SENTENCE",
        ),
      );
    await page.locator("#btn-view").click();
    await expect(
      page.locator("folio-doc p", { hasText: "REWRITTEN INTRO SENTENCE" }),
    ).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).toBeVisible();
  });
});
