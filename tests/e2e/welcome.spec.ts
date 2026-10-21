import { expect, test } from "@playwright/test";

/**
 * The welcome page (spec: docs/specs/welcome-page.md): folio boots
 * into a front page that says what folio is, proves it with a live
 * table and chart, and links every example; `?doc=` deep-links a
 * shipped document; the wordmark and the palette lead home.
 */

test.describe("welcome page", () => {
  test("boots into the front page with a live example and the examples list", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#the-doc h1").first()).toHaveText("folio");
    // The live demo: editing a cost recalculates the share.
    const fig = page.locator('#the-doc figure[data-table-id="launch-budget"]');
    const share = fig.locator(
      'tbody tr[data-row-index="0"] td[data-col-index="2"]',
    );
    await expect(share).toHaveText("52.6%");
    await fig
      .locator('tbody tr[data-row-index="0"] td[data-col-index="1"]')
      .click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("57");
    await page.keyboard.press("Tab");
    await expect(share).toHaveText("67.9%");
    // Every shipped example is linked from a real list.
    const links = page.locator("#the-doc article > ul li a");
    await expect(links).toHaveCount(7);
  });

  test("an example link opens in place; the wordmark comes home", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator("#the-doc a", { hasText: "Q3 Field Operations Review" })
      .click();
    await expect(page.locator("#the-doc h1").first()).toHaveText(
      "Q3 Field Operations Review",
    );
    await page.locator("#btn-home").click();
    await expect(page.locator("#the-doc h1").first()).toHaveText("folio");
  });

  test("?doc= opens a shipped document; junk falls back home", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/poem.md");
    await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
    await page.goto("/?doc=https://example.com/x.md");
    await expect(page.locator("#the-doc h1").first()).toHaveText("folio");
  });

  test("the palette opens the welcome page and the moved sample", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/poem.md");
    await page.locator("#the-doc h1").first().waitFor();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("welcome");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc h1").first()).toHaveText("folio");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("field operations");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc h1").first()).toHaveText(
      "Q3 Field Operations Review",
    );
  });

  // Regressions found by the first-contact eval.
  test("an opened document starts at its top, and Back returns home", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.locator("#the-doc a", { hasText: "A technical paper" });
    await link.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    await link.click();
    await expect(page.locator("#the-doc h1").first()).toHaveText(
      "Compiling expressions: notes",
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(page.url()).toContain("?doc=demo/examples/technical.md");
    await page.goBack();
    await expect(page.locator("#the-doc h1").first()).toHaveText("folio");
    await page.goForward();
    await expect(page.locator("#the-doc h1").first()).toHaveText(
      "Compiling expressions: notes",
    );
  });

  test("Back restores where you were on the previous document", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.locator("#the-doc a", { hasText: "Management accounts" });
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(200);
    await link.click();
    await expect(page.locator("#the-doc h1").first()).toHaveText(
      "Half-year management accounts",
    );
    await page.goBack();
    await expect(page.locator("#the-doc h1").first()).toHaveText("folio");
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(before - 5);
  });

  test("opening a document clears stale toolbar highlights", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#the-doc li").first().click();
    await expect(
      page.locator('#block-bar button[data-block="ul"]'),
    ).toHaveClass(/active/);
    await page.locator("#the-doc li a").first().click();
    await expect(page.locator("#the-doc h1").first()).toHaveText(
      "Q3 Field Operations Review",
    );
    await expect(page.locator("#block-bar button.active")).toHaveCount(0);
  });
});
