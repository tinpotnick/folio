import { expect, test, type Page } from "@playwright/test";

/**
 * Typing in a cell writes the text; the table recalculates when the
 * caret leaves the cell (docs/specs/formulas.md, "Recalculation") - not
 * on every letter, which took a beat per keystroke on a big document.
 */

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  await page.locator("#editor").fill(`# T

::: table {#t}
columns:
  - {name: a, type: number}
  - {name: b, type: formula, expr: "a * 2"}
data:
  - [1, ""]
  - [2, ""]
:::

After the table.
`);
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-view")?.click(),
  );
}

test.describe("recalculation waits for the cell to be left", () => {
  test("typing does not recalculate; Tab does", async ({ page }) => {
    await open(page);
    const fig = page.locator('#the-doc figure[data-table-id="t"]');
    const a = fig.locator('td[data-row-index="0"][data-col-index="0"]');
    const b = fig.locator('td[data-row-index="0"][data-col-index="1"]');
    await expect(b).toHaveText("2");
    await a.click();
    await page.keyboard.press("End");
    await page.keyboard.type("23");
    // Still in the cell: the formula has not moved.
    await expect(a).toHaveText("123");
    await page.waitForTimeout(300);
    await expect(b).toHaveText("2");
    await page.keyboard.press("Tab");
    await expect(b).toHaveText("246");
  });

  test("clicking elsewhere recalculates, and the source has the text", async ({
    page,
  }) => {
    await open(page);
    const fig = page.locator('#the-doc figure[data-table-id="t"]');
    const a = fig.locator('td[data-row-index="1"][data-col-index="0"]');
    const b = fig.locator('td[data-row-index="1"][data-col-index="1"]');
    await a.click();
    await page.keyboard.press("End");
    await page.keyboard.type("0");
    await expect(b).toHaveText("4");
    await page.locator("#the-doc p", { hasText: "After the table" }).click();
    await expect(b).toHaveText("40");
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    expect(await page.locator("#editor").inputValue()).toContain("  - [20, ");
  });
});
