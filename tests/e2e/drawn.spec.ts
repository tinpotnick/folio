import { expect, test, type Page } from "@playwright/test";
import { readThrough, scrollToFigure } from "./reader";

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

test.describe("Vega-Lite", () => {
  test("the sample's charts read the dataset, and follow its edits", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/drawings.md");
    await page.locator("#the-doc h1").first().waitFor();
    await readThrough(page);
    const views = page.locator(
      "#the-doc figure.folio-vega-lite .code-view svg",
    );
    await expect(views).toHaveCount(2, { timeout: 20_000 });
    await expect(page.locator("#the-doc .drawn-error")).toHaveCount(0);
    const heat = views.first();
    const before = await heat.innerHTML();
    const cell = page.locator(
      '#the-doc figure[data-table-id="visits"] td[data-row-index="0"][data-col-index="2"]',
    );
    await cell.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => heat.innerHTML(), { timeout: 10_000 })
      .not.toBe(before);
  });

  test("URL data is refused: documents render offline", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("example.com")) remote.push(r.url());
    });
    await loadDoc(
      page,
      '# T\n\n```vega-lite\n{"data": {"url": "https://example.com/d.csv"}, "mark": "point"}\n```\n',
    );
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "render offline",
      { timeout: 15_000 },
    );
    expect(remote).toEqual([]);
  });

  test("invalid JSON says so, and the palette inserts a chart", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n```vega-lite\n{ nope\n```\n\nIntro\n");
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "not valid JSON",
      { timeout: 15_000 },
    );
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("vega");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure.folio-vega-lite .code-view svg"),
    ).toHaveCount(1, { timeout: 15_000 });
  });
});

test.describe("SVG drawings", () => {
  test("the sample draws, following the theme's ink", async ({ page }) => {
    await page.goto("/?doc=demo/examples/drawings.md");
    await scrollToFigure(page.locator("#the-doc figure.folio-svg"));
    const svg = page.locator("#the-doc figure.folio-svg .code-view svg");
    await expect(svg).toBeVisible({ timeout: 10_000 });
    const ink = await svg
      .locator("text")
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
    const article = await page
      .locator("#the-doc article")
      .evaluate((el) => getComputedStyle(el).color);
    expect(ink).toBe(article);
  });

  test("scripts, handlers and outside loads are removed", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("example.com")) remote.push(r.url());
    });
    let alerted = false;
    page.on("dialog", (d) => {
      alerted = true;
      void d.dismiss();
    });
    await loadDoc(
      page,
      '# T\n\n```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="5" height="5" onclick="alert(2)"/><image href="https://example.com/x.png" width="5" height="5"/></svg>\n```\n',
    );
    const view = page.locator("#the-doc figure.folio-svg .code-view");
    await expect(view.locator("rect")).toHaveCount(1);
    const html = await view.innerHTML();
    expect(html).not.toMatch(/script|onclick|example\.com/);
    await view.locator("rect").click({ force: true });
    expect(alerted).toBe(false);
    expect(remote).toEqual([]);
  });

  test("markup that is not SVG says so; the palette inserts one", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n```svg\n<div>no</div>\n```\n\nIntro\n");
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "Drawing error: not valid SVG",
    );
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("svg drawing");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure.folio-svg .code-view svg"),
    ).toHaveCount(1);
  });
});

test.describe("ABC sheet music", () => {
  test("the sample engraves a score in the theme's ink", async ({ page }) => {
    await page.goto("/?doc=demo/examples/drawings.md");
    await scrollToFigure(page.locator("#the-doc figure.folio-abc"));
    const score = page.locator("#the-doc figure.folio-abc .abc-score svg");
    await expect(score).toBeVisible({ timeout: 15_000 });
    expect(await score.locator(".abcjs-note").count()).toBeGreaterThan(20);
    await expect(
      page.locator("#the-doc figure.folio-abc .drawn-error"),
    ).toHaveCount(0);
  });

  test("Play sounds it offline; Stop silences it", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      if (!r.url().includes("localhost")) remote.push(r.url());
    });
    await page.goto("/?doc=demo/examples/drawings.md");
    const fig = page.locator("#the-doc figure.folio-abc");
    await scrollToFigure(fig);
    await expect(fig.locator(".abc-score svg")).toBeVisible({
      timeout: 15_000,
    });
    await fig.locator(".code-view").click();
    await fig.locator(".abc-play").click();
    await expect(fig).toHaveAttribute("data-playing", "true");
    await expect(fig.locator(".abc-play")).toContainText("Playing");
    await fig.locator(".abc-stop").click();
    await expect(fig).not.toHaveAttribute("data-playing", "true");
    // No soundfont (or anything else) was fetched.
    expect(remote).toEqual([]);
  });

  test("text that is not a tune says so; the palette inserts one", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n```abc\nT:Only a title\n```\n\nIntro\n");
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "Music error",
      { timeout: 10_000 },
    );
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("sheet music");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure.folio-abc .abc-score svg"),
    ).toHaveCount(1, { timeout: 10_000 });
  });
});
