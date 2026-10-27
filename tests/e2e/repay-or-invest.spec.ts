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
    await expect(summary.locator("tbody td").first()).toHaveText("40,200.00");
    const repaying = await summary.locator("tbody td").nth(1).textContent();
    // Double the monthly extra: twice the money in, more saved.
    const extra = page
      .locator('#the-doc figure[data-table-id="assume"] tbody td')
      .nth(2);
    await extra.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");
    await expect(summary.locator("tbody td").first()).toHaveText("80,400.00");
    await expect(summary.locator("tbody td").nth(1)).not.toHaveText(
      repaying ?? "",
    );
    // Its sources are cited, each with its retrieval date.
    await expect(page.locator("#the-doc ol.folio-refs li")).toHaveCount(3);
    await expect(page.locator("#the-doc ol.folio-refs")).toContainText(
      "Retrieved 27 October 2026",
    );
  });
});
