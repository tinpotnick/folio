import { expect, test, type Page } from "@playwright/test";

/**
 * Equations: $$ display math blocks (ADR-0011). LaTeX in the
 * source, typeset output in the document, lossless round-trip.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

test.describe("math blocks", () => {
  test("a $$ block renders typeset math", async ({ page }) => {
    await loadDoc(page, "# T\n\n$$\nE = mc^2\n$$\n");
    await expect(
      page.locator("#the-doc figure.folio-math .katex"),
    ).toBeVisible();
    await expect(
      page.locator("#the-doc figure.folio-math .katex"),
    ).toContainText("E=mc2");
  });

  test("a math block survives a full view round-trip", async ({ page }) => {
    await loadDoc(page, "# T\n\n$$\nE = mc^2\n$$\n");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe(
      "# T\n\n$$\nE = mc^2\n$$\n",
    );
    await page.locator("#btn-view").click();
    await expect(
      page.locator("#the-doc figure.folio-math .katex"),
    ).toBeVisible();
  });

  test("bad LaTeX renders an inline error, not a crash", async ({ page }) => {
    await loadDoc(page, "# T\n\n$$\n\\notacommand\n$$\n");
    // throwOnError: false renders the unknown command as visible
    // red text inside the math, matching the diagram error
    // contract (error as content, never a broken render).
    const math = page.locator("#the-doc figure.folio-math .katex");
    await expect(math).toBeVisible();
    await expect(math).toContainText("notacommand");
    await expect(page.locator("#the-doc figure.folio-math")).not.toContainText(
      "Math error:",
    );
    await expect(page.locator("#status")).not.toContainText("Parse error");
  });

  test("editing prose around a math block preserves it", async ({ page }) => {
    await loadDoc(page, "# T\n\nbefore\n\n$$\nx^2\n$$\n\nafter\n");
    await page.locator("#the-doc p", { hasText: "before" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("middle");
    const doc = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => { blocks: { kind: string }[] };
        }
      ).getDoc(),
    );
    expect(doc.blocks.filter((b) => b.kind === "math").length).toBe(1);
  });

  test("Enter on a math figure does not split anything", async ({ page }) => {
    await loadDoc(page, "# T\n\n$$\nx^2\n$$\n");
    const figure = page.locator("#the-doc figure.folio-math");
    await figure.click();
    await page.keyboard.press("Enter");
    await expect(figure).toBeVisible();
    const doc = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => { blocks: { kind: string }[] };
        }
      ).getDoc(),
    );
    expect(doc.blocks.filter((b) => b.kind === "math").length).toBe(1);
  });

  test("the Markdown view highlights $$ lines as math", async ({ page }) => {
    await loadDoc(page, "# T\n\n$$\nx^2\n$$\n");
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-view .tk-math").first()).toBeVisible();
  });
});
