import { expect, test, type Page } from "@playwright/test";

/**
 * Lazy figures (docs/specs/section-windowing.md, option 2): generated
 * figures (charts, diagrams, math, models) draw only when scrolled
 * near the viewport; print/export draws them all first.
 */

const FILLER = Array.from(
  { length: 200 },
  (_, i) => `Paragraph ${String(i)} with some words to push it down.`,
).join("\n\n");

const DOC = `# T

${FILLER}

::: table {#d}
columns:
  - {name: x, type: number}
  - {name: y, type: number}
data:
  - [1, 2]
  - [2, 4]
:::

::: chart {#c}
source: @d
query: {select: [x, y]}
type: bar
:::
`;

async function loadDoc(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("#the-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(DOC);
  await page.locator("#btn-view").click();
  // The figure is below the fold: wait for attached, not visible.
  await page
    .locator('figure[data-chart-source="d"]')
    .waitFor({ state: "attached" });
}

test("an off-screen chart is pending, and draws when scrolled into view", async ({
  page,
}) => {
  await loadDoc(page);
  const fig = page.locator('figure[data-chart-source="d"]');
  // Below the fold (and outside the observer's margin): not drawn.
  await expect(fig).toHaveAttribute("data-pending", "figure");
  await expect(fig.locator(".chart-holder svg")).toHaveCount(0);
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".chart-holder svg")).toHaveCount(1);
  await expect(fig).not.toHaveAttribute("data-pending", /.*/);
});

test("drawAllFigures (print/export path) draws pending figures without scrolling", async ({
  page,
}) => {
  await loadDoc(page);
  const fig = page.locator('figure[data-chart-source="d"]');
  await expect(fig).toHaveAttribute("data-pending", "figure");
  await page.evaluate(() =>
    (
      document.querySelector("#the-doc") as unknown as {
        drawAllFigures(): Promise<void>;
      }
    ).drawAllFigures(),
  );
  await expect(fig.locator(".chart-holder svg")).toHaveCount(1);
  await expect(fig).not.toHaveAttribute("data-pending", /.*/);
});

test("beforeprint draws pending figures (paper never shows a blank figure)", async ({
  page,
}) => {
  await loadDoc(page);
  const fig = page.locator('figure[data-chart-source="d"]');
  await expect(fig).toHaveAttribute("data-pending", "figure");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(fig.locator(".chart-holder svg")).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
});
