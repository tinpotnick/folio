import { expect, test, type Page } from "@playwright/test";

/**
 * Show (docs/specs/drawn-blocks.md): a drawn block shows its drawing,
 * its code, or both - on screen and on paper - written as `show=`.
 */
async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/drawings.md");
  await page.locator("#the-doc h1").first().waitFor();
}

const graph = (page: Page) => page.locator("#the-doc figure.folio-dot").first();

async function fences(page: Page): Promise<string[]> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return md.split("\n").filter((l) => /^```\S/.test(l));
}

async function show(page: Page, value: string): Promise<void> {
  const fig = graph(page);
  if (await fig.locator(".code-view").isVisible()) {
    await fig.locator(".code-view").click();
  } else {
    await fig.locator("pre.folio-code").click();
  }
  await fig.locator(".code-show").selectOption(value);
  // Click away: the header closes; what shows is the block's choice.
  await page.locator("#the-doc h1").first().click();
}

test.describe("show a drawing, its code, or both", () => {
  test("drawing by default; both and code stay after clicking away", async ({
    page,
  }) => {
    await open(page);
    const fig = graph(page);
    await expect(fig.locator(".code-view svg")).toBeVisible();
    await expect(fig.locator("pre.folio-code")).toBeHidden();

    await show(page, "both");
    await expect(fig.locator(".folio-inspector")).toBeHidden();
    await expect(fig.locator(".code-view svg")).toBeVisible();
    await expect(fig.locator("pre.folio-code")).toBeVisible();
    expect(await fences(page)).toContain("```dot show=both");

    await show(page, "code");
    await expect(fig.locator(".code-view")).toBeHidden();
    await expect(fig.locator("pre.folio-code")).toBeVisible();
    expect(await fences(page)).toContain("```dot show=code");

    await show(page, "drawing");
    await expect(fig.locator(".code-view svg")).toBeVisible();
    await expect(fig.locator("pre.folio-code")).toBeHidden();
    expect((await fences(page))[0]).toBe("```dot");
  });

  test("paper shows what the block chose", async ({ page }) => {
    await open(page);
    await show(page, "both");
    const vega = page.locator("#the-doc figure.folio-vega-lite").first();
    await page.emulateMedia({ media: "print" });
    await expect(graph(page).locator("pre.folio-code")).toBeVisible();
    await expect(graph(page).locator(".code-view")).toBeVisible();
    // A block left at "drawing" prints without its code.
    await expect(vega.locator("pre.folio-code")).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await show(page, "code");
    await page.emulateMedia({ media: "print" });
    await expect(graph(page).locator("pre.folio-code")).toBeVisible();
    await expect(graph(page).locator(".code-view")).toBeHidden();
  });

  test("Ctrl+K reaches the picker for the drawing last used", async ({
    page,
  }) => {
    await open(page);
    await graph(page).locator(".code-view").click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("show code");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Show code or drawing (or both)");
    await page.keyboard.press("Enter");
    await expect(graph(page).locator(".code-show")).toBeFocused();
  });
});
