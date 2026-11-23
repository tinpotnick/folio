import { expect, test, type Page } from "@playwright/test";

/** Subscript and superscript (spec: docs/specs/inline-syntax.md). */

async function load(page: Page, md: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  await page.locator("#editor").fill(md);
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-view")?.click(),
  );
  await page.locator("#the-doc h1").first().waitFor();
}

const toSource = async (page: Page): Promise<string> => {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  return page.locator("#editor").inputValue();
};

test.describe("subscript and superscript", () => {
  test("~x~ and ^x^ render as sub/sup and round-trip in the source", async ({
    page,
  }) => {
    await load(
      page,
      "# T\n\nH~2~O and x^2^ plus ~~gone~~ and note[^a].\n\n[^a]: a note\n",
    );
    await expect(page.locator("#the-doc sub")).toHaveText("2");
    await expect(page.locator("#the-doc sup:not(.folio-fnref)")).toHaveText(
      "2",
    );
    await expect(page.locator("#the-doc del")).toHaveText("gone");
    const md = await toSource(page);
    expect(md).toContain("H~2~O");
    expect(md).toContain("x^2^");
    expect(md).toContain("~~gone~~");
    expect(md).toContain("[^a]");
  });

  test("the style menu's Superscript/Subscript items wrap the selection", async ({
    page,
  }) => {
    await load(page, "# T\n\nplain words here\n");
    const p = page.locator("#the-doc p", { hasText: "plain words" });
    await p.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.locator("#btn-style-menu").click();
    await page.locator('#style-menu button[data-inline="sup"]').click();
    await expect(page.locator("#the-doc sup:not(.folio-fnref)")).toHaveText(
      "plain words here",
    );
    // Toggle off again with the same item.
    await page.locator("#btn-style-menu").click();
    await page.locator('#style-menu button[data-inline="sup"]').click();
    await expect(page.locator("#the-doc sup:not(.folio-fnref)")).toHaveCount(0);
    // Subscript via the menu.
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.locator("#btn-style-menu").click();
    await page.locator('#style-menu button[data-inline="sub"]').click();
    await expect(page.locator("#the-doc sub")).toHaveText("plain words here");
    const md = await toSource(page);
    expect(md).toContain("~plain words here~");
  });
});
