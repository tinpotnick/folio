import { expect, test } from "@playwright/test";

/**
 * The "Repay or invest?" example (demo/examples/repay-or-invest.md):
 * real open data, formulas over it, and assumptions that drive every
 * figure.
 */

test.describe("Repay or invest? example", () => {
  test("round-trips byte for byte", async ({ page }) => {
    const source = await (
      await page.request.get("/demo/examples/repay-or-invest.md")
    ).text();
    await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
    await page.goto("/?doc=demo/examples/repay-or-invest.md");
    await page.locator("#the-doc h1").first().waitFor();
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    expect(await page.locator("#editor").inputValue()).toBe(source);
  });

  test("the result follows the assumptions", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
    await page.goto("/?doc=demo/examples/repay-or-invest.md");
    const summary = page.locator('#the-doc figure[data-table-id="summary"]');
    const cell = (i: number) => summary.locator("tbody td").nth(i);
    // The same total paid either way; the debt held stays the loan.
    await expect(cell(0)).toHaveText("185,399.01");
    await expect(cell(2)).toHaveText("200,000.00");
    const ahead = await cell(4).textContent();
    // A bigger loan: more paid, more owed, a different answer.
    const loan = page
      .locator('#the-doc figure[data-table-id="assume"] tbody td')
      .first();
    await loan.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("300000");
    await page.keyboard.press("Tab");
    await expect(cell(2)).toHaveText("300,000.00");
    await expect(cell(4)).not.toHaveText(ahead ?? "");
    // Its sources are cited, each with its retrieval date.
    await expect(page.locator("#the-doc ol.folio-refs li")).toHaveCount(3);
    await expect(page.locator("#the-doc ol.folio-refs")).toContainText(
      "Retrieved 27 October 2026",
    );
  });
});
