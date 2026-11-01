import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { scrollToFigure } from "./reader";

/**
 * Findings from the drawing-languages first-contact eval: each test
 * failed before its fix.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

const LONG = `# T

::: table {#sales}
columns:
  - {name: month, type: text}
  - {name: region, type: text}
  - {name: revenue, type: number}
data:
  - [Jan, North, 10]
  - [Jan, South, 8]
  - [Feb, North, 12]
  - [Feb, South, 9]
:::

First paragraph.

Second paragraph.
`;

test.describe("eval polish", () => {
  test("the palette finds help by words in its body: stacked, grouped bar", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/field-operations.md");
    await page.locator("folio-doc h1").first().waitFor();
    for (const q of ["stacked", "grouped bar"]) {
      await page.keyboard.press("Control+k");
      await page.locator("#palette-input").fill(q);
      await expect(page.locator("#palette-list")).toContainText("Help: Charts");
      await page.keyboard.press("Escape");
    }
  });

  test("Insert a chart puts it at the caret, split by a repeating label", async ({
    page,
  }) => {
    await loadDoc(page, LONG);
    await page.locator("#the-doc p", { hasText: "Second paragraph" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert a chart");
    await page.keyboard.press("Enter");
    // Below the caret's paragraph, not under the table.
    const after = page.locator(
      "#the-doc p:has-text('Second paragraph') + figure",
    );
    await expect(after).toHaveAttribute("data-chart-source", "sales");
    // Four rows but two months: one series per region, not four bars.
    await expect(after.locator(".legend-item")).toHaveText(["North", "South"]);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "type: bar\nseries: region",
    );
  });

  test("Vega-Lite text is a readable size", async ({ page }) => {
    await page.goto("/?doc=demo/examples/drawings.md");
    await scrollToFigure(
      page.locator("#the-doc figure.folio-vega-lite").first(),
    );
    const svg = page
      .locator("#the-doc figure.folio-vega-lite .code-view svg")
      .first();
    await expect(svg).toBeVisible({ timeout: 20_000 });
    const sizes = await svg
      .locator("text")
      .evaluateAll((ts) =>
        ts.map((t) => parseFloat(t.getAttribute("font-size") ?? "0")),
      );
    expect(Math.min(...sizes.filter((s) => s > 0))).toBeGreaterThanOrEqual(11);
  });

  test("a dark heatmap's lowest cells stand out from the paper", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/sales-review.md");
    await page.locator("#btn-mode").click();
    await scrollToFigure(
      page.locator("#the-doc figure.folio-vega-lite").first(),
    );
    const svg = page
      .locator("#the-doc figure.folio-vega-lite .code-view svg")
      .first();
    await expect(svg).toBeVisible({ timeout: 20_000 });
    const lum = (rgb: string): number => {
      const [r = 0, g = 0, b = 0] = rgb.match(/[\d.]+/g)?.map(Number) ?? [];
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const paper = await page
      .locator("#the-doc")
      .evaluate((d) => getComputedStyle(d).getPropertyValue("--folio-paper"));
    const cells = svg.locator('path[aria-roledescription="rect mark"]');
    await expect(cells).toHaveCount(18);
    const fills = await cells.evaluateAll((ps) =>
      ps.map((p) => p.getAttribute("fill") ?? ""),
    );
    const hex = paper.trim().replace("#", "");
    const paperLum = lum(
      `rgb(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)})`,
    );
    const nearest = Math.min(...fills.map((f) => Math.abs(lum(f) - paperLum)));
    expect(nearest).toBeGreaterThan(0.07);
  });

  test("ABC Stop is disabled until playing; header buttons are styled", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/drawings.md");
    const fig = page.locator("#the-doc figure.folio-abc");
    await scrollToFigure(fig);
    await expect(fig.locator(".abc-score svg")).toBeVisible({
      timeout: 15_000,
    });
    await fig.locator(".code-view").click();
    await expect(fig.locator(".abc-stop")).toBeDisabled();
    const radius = await fig
      .locator(".abc-play")
      .evaluate((b) => getComputedStyle(b).borderTopLeftRadius);
    expect(radius).toBe("5px");
    await fig.locator(".abc-play").click();
    await expect(fig.locator(".abc-stop")).toBeEnabled();
    await fig.locator(".abc-stop").click();
    await expect(fig.locator(".abc-stop")).toBeDisabled();
  });

  test("code shows -> as typed: no ligatures", async ({ page }) => {
    await loadDoc(page, "# T\n\n```js\nconst f = (a) => a -> b\n```\n");
    const lig = await page
      .locator("#the-doc pre code")
      .first()
      .evaluate((c) => getComputedStyle(c).fontVariantLigatures);
    expect(lig).toBe("none");
  });

  test("Export STL is named for the bound row", async ({ page }) => {
    await page.goto("/?doc=demo/examples/design-review.md");
    const fig = page.locator("#the-doc figure.folio-jscad").first();
    await expect(fig.locator(".jscad-view svg")).toBeVisible({
      timeout: 10_000,
    });
    await fig.locator(".jscad-view").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      fig.getByRole("button", { name: /Export STL/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("variants-B.stl");
    const stl = readFileSync(await download.path(), "utf8");
    expect(stl.startsWith("solid variants-B")).toBe(true);
  });
});
