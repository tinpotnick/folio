import { expect, test, type Page } from "@playwright/test";

/** Export as PDF (spec: docs/specs/print.md). On the web it is the
 * print dialog with a hint; the desktop writes the file itself. */

async function stubPrint(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { printed: number };
    w.printed = 0;
    window.print = () => {
      w.printed += 1;
    };
  });
}
const printed = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { printed: number }).printed);

test.describe("export", () => {
  test("Export › PDF document prints, with a word on Save as PDF", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/sales-review.md");
    await page.locator("#the-doc h1").first().waitFor();
    await stubPrint(page);
    await page.locator("#btn-export-menu").click();
    await page.locator("#export-menu #btn-export-pdf").click();
    await expect.poll(() => printed(page)).toBe(1);
    await expect(page.locator("#status")).toContainText("Save as PDF");
  });

  test("the palette finds it by export and by pdf", async ({ page }) => {
    await page.goto("/?doc=demo/examples/poem.md");
    await page.locator("#the-doc h1").first().waitFor();
    for (const q of ["export", "pdf"]) {
      await page.keyboard.press("Control+k");
      await page.locator("#palette-input").fill(q);
      await expect(
        page.locator("#palette-list .palette-item").first(),
      ).toContainText("Export as PDF");
      await page.keyboard.press("Escape");
    }
  });

  test("from the Markdown view it exports the document", async ({ page }) => {
    await page.goto("/?doc=demo/examples/poem.md");
    await page.locator("#the-doc h1").first().waitFor();
    await page.locator("#btn-markdown").click();
    await stubPrint(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("export as pdf");
    await page.keyboard.press("Enter");
    await expect.poll(() => printed(page)).toBe(1);
    await expect(page.locator("#md-wrap")).toBeHidden();
  });

  test("on a phone, Export opens from inside More tools", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/?doc=demo/examples/poem.md");
    await page.locator("#the-doc h1").first().waitFor();
    await stubPrint(page);
    await page.locator("#btn-overflow").click();
    await page.locator("#overflow-menu #btn-export-menu").click();
    await expect(page.locator("#overflow-menu")).toBeVisible();
    const pdf = page.locator("#btn-export-pdf");
    await expect(pdf).toBeInViewport();
    await pdf.click();
    await expect.poll(() => printed(page)).toBe(1);
  });
});
