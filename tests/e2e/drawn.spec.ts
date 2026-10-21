import { expect, test, type Page } from "@playwright/test";

/** Drawn code blocks (spec: docs/specs/drawn-blocks.md). */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

test.describe("Graphviz", () => {
  test("the sample draws its graphs, themed, with no errors", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/drawings.md");
    const views = page.locator("#the-doc figure.folio-dot .code-view svg");
    await expect(views).toHaveCount(2, { timeout: 15_000 });
    await expect(page.locator("#the-doc .drawn-error")).toHaveCount(0);
    // Nodes carry the theme's text face, not Times.
    const font = await views
      .first()
      .locator("text")
      .first()
      .getAttribute("font-family");
    expect(font).toContain("Literata");
    // Code hidden until a click.
    await expect(
      page.locator("#the-doc figure.folio-dot pre.folio-code").first(),
    ).toBeHidden();
  });

  test("editing redraws; a syntax error is the figure", async ({ page }) => {
    await loadDoc(page, "# T\n\n```dot\ndigraph { a -> b }\n```\n");
    const fig = page.locator("#the-doc figure.folio-dot");
    await expect(fig.locator(".code-view svg g.node")).toHaveCount(2, {
      timeout: 10_000,
    });
    await fig.locator(".code-view").click();
    await fig.locator("pre.folio-code code").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.type(" b -> c");
    await expect(fig.locator(".code-view svg g.node")).toHaveCount(3, {
      timeout: 10_000,
    });
    await page.keyboard.type(" -> ");
    await expect(fig.locator(".drawn-error")).toContainText("Diagram error", {
      timeout: 10_000,
    });
  });

  test("DOT links cannot run script", async ({ page }) => {
    await loadDoc(
      page,
      '# T\n\n```dot\ndigraph { a [URL="javascript:alert(1)"] }\n```\n',
    );
    const view = page.locator("#the-doc figure.folio-dot .code-view");
    await expect(view.locator("svg")).toBeVisible({ timeout: 10_000 });
    expect(await view.innerHTML()).not.toContain("javascript");
  });

  test("the palette inserts a diagram", async ({ page }) => {
    await loadDoc(page, "# T\n\nIntro\n");
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("graphviz");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure.folio-dot .code-view svg"),
    ).toBeVisible({ timeout: 10_000 });
  });
});
