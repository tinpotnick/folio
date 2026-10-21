import { expect, test, type Page } from "@playwright/test";
import { pickStyle, insertFrom } from "./toolbar-helpers";

/**
 * Insert-group equation, H3 support, header-click inspector, and
 * the figure inspectors (chart, math, diagram): generated blocks
 * are editable from the document view - no dropping to the
 * Markdown source.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await waitForDocument(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

test.describe("insert equation", () => {
  test("the insert-group button adds a math block and the source shows it", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await insertFrom(page, "btn-equation");
    await expect(page.locator("#the-doc figure.folio-math .katex")).toBeVisible(
      { timeout: 10_000 },
    );
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /\$\$\nE = mc\^2\n\$\$/,
    );
  });

  test("the palette command inserts an equation too", async ({ page }) => {
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("equation");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc figure.folio-math .katex")).toBeVisible(
      { timeout: 10_000 },
    );
  });
});

test.describe("H3 support", () => {
  test("the H3 button converts a paragraph and the button follows the caret", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await pickStyle(page, "h3");
    await expect(
      page.locator("#the-doc h3", { hasText: "Revenue recovered" }),
    ).toBeVisible();
    await expect(
      page.locator('#block-bar button[data-block="h3"]'),
    ).toHaveClass(/active/);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /^### Revenue recovered/m,
    );
  });

  test("H3 size is a document setting", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-h3-size").fill("15pt");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /h3\.font\.size: 15pt/,
    );
  });
});

test.describe("header-click inspector", () => {
  test("clicking a column heading opens that column in the bar", async ({
    page,
  }) => {
    await waitForDocument(page);
    const insp = page.locator(
      '#the-doc figure[data-table-id="regional-data"] .folio-inspector',
    );
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] th[data-col-index="3"]',
      )
      .click();
    await expect(insp).toBeVisible();
    await expect(insp.locator(".insp-expr")).toHaveValue("(q3 - q2) / q2");
    // The unit field renders in italic (it is metadata, not a name).
    const style = await insp
      .locator(".insp-unit")
      .evaluate((el) => getComputedStyle(el).fontStyle);
    expect(style).toBe("italic");
  });
});

test.describe("chart inspector", () => {
  test("flipping a chart to line draws a polyline", async ({ page }) => {
    await waitForDocument(page);
    const figure = page.locator(
      '#the-doc figure[data-chart-source="regional-data"]',
    );
    await figure.locator(".chart-holder").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator(".insp-type").selectOption("line");
    await expect(figure.locator("svg polyline")).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain("type: line");
  });

  test("editing the filter and caption reaches the source and redraws", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator(
      '#the-doc figure[data-chart-source="regional-data"]',
    );
    await figure.locator(".chart-holder").click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-filter").fill("q2 > 400");
    await insp.locator(".insp-filter").press("Enter");
    // Only North passes the filter.
    await expect(figure.locator("svg")).toContainText("North");
    await expect(figure.locator("svg")).not.toContainText("South");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'filter: "q2 > 400"',
    );
  });
});

test.describe("math and diagram inspectors", () => {
  test("editing an equation in place re-renders it", async ({ page }) => {
    await loadDoc(page, "# T\n\n$$\nE = mc^2\n$$\n");
    const figure = page.locator("#the-doc figure.folio-math");
    await figure.locator(".math-holder").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator("textarea").fill("a^2 + b^2 = c^2");
    await insp.locator("textarea").press("Enter");
    await expect(figure.locator(".katex")).toContainText("a2+b2=c2");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "a^2 + b^2 = c^2",
    );
  });

  test("figure inspectors hide on outside clicks - the table contract", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator(
      '#the-doc figure[data-chart-source="regional-data"]',
    );
    await figure.locator(".chart-holder").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    // No close button: the outside click IS the dismissal, and
    // every inspector bar follows the same rule.
    await expect(insp.locator(".insp-close")).toHaveCount(0);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(insp).toBeHidden();
    // Esc inside the bar dismisses early, exactly like the table
    // inspector's bar.
    await figure.locator(".chart-holder").click();
    await expect(insp).toBeVisible();
    await insp.locator(".insp-source").press("Escape");
    await expect(insp).toBeHidden();
  });

  test("the table inspector still hides on outside clicks", async ({
    page,
  }) => {
    await waitForDocument(page);
    const tableBar = page.locator(
      '#the-doc figure[data-table-id="regional-data"] .folio-inspector',
    );
    await page
      .locator(
        '#the-doc figure[data-table-id="regional-data"] td[data-row-index="0"][data-col-index="1"]',
      )
      .click();
    await expect(tableBar).toBeVisible();
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(tableBar).toBeHidden();
  });

  test("editing a diagram's Mermaid source in place re-renders it", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n::: mermaid {#d}\ngraph TD\n  A --> B\n:::\n");
    const figure = page.locator("#the-doc figure.folio-diagram");
    await figure.locator(".diagram-holder").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator("textarea").fill("graph TD\n  C --> D");
    await insp.locator("textarea").press("Enter");
    await expect(figure.locator("svg")).toBeVisible({ timeout: 10_000 });
    const svg = await figure.locator("svg").textContent();
    expect(svg).toContain("C");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "graph TD\n  C --> D",
    );
  });
});

test.describe("chart types", () => {
  const pieDoc = `# T

::: table {#t}
columns:
  - {name: k, type: text}
  - {name: v, type: number}
data:
  - [a, 1]
  - [b, 2]
  - [c, 3]
:::

::: chart {#c}
source: @t
query: {select: [k, v]}
type: pie
:::
`;

  test("pie renders slices with percentage labels and round-trips", async ({
    page,
  }) => {
    await loadDoc(page, pieDoc);
    const holder = page.locator("#the-doc figure .chart-holder");
    await expect(holder.locator("svg path")).toHaveCount(3);
    await expect(holder).toContainText("a 17%");
    await expect(holder).toContainText("c 50%");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain("type: pie");
  });

  test("the type select offers all six types and donut redraws in place", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator(
      '#the-doc figure[data-chart-source="regional-data"]',
    );
    await figure.locator(".chart-holder").click();
    const insp = figure.locator(".folio-inspector");
    const options = insp.locator(".insp-type option");
    await expect(options).toHaveCount(6);
    await insp.locator(".insp-type").selectOption("donut");
    // A donut is a pie (3 slices for 3 regions) with a
    // punched-out white center.
    await expect(figure.locator("svg path")).toHaveCount(3);
    // The hole is the page's own paper (the theme's, per mode).
    await expect(figure.locator("svg circle[fill='#ffffff']")).toHaveCount(1);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain("type: donut");
  });

  test("negative values are a visible pie error, not a broken render", async ({
    page,
  }) => {
    await loadDoc(page, pieDoc.replace("  - [c, 3]", "  - [c, -3]"));
    await expect(page.locator("#the-doc figure .chart-holder")).toContainText(
      "Chart error",
    );
  });

  test("area fills to the zero baseline; scatter draws a numeric x axis", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `# T

::: table {#t}
columns:
  - {name: k, type: number}
  - {name: v, type: number}
data:
  - [1, 10]
  - [2, 20]
  - [3, 15]
:::

::: chart {#c}
source: @t
query: {select: [k, v]}
type: area
:::

::: chart {#s}
source: @t
query: {select: [k, v]}
type: scatter
:::
`,
    );
    const figures = page.locator("#the-doc figure .chart-holder");
    await expect(figures.nth(0).locator("svg polygon")).toHaveCount(1);
    await expect(figures.nth(0).locator("svg polyline")).toHaveCount(1);
    // Scatter: points on a numeric x domain (the bottom axis shows
    // numbers, not category names).
    const scatter = figures.nth(1);
    await expect(scatter.locator("svg circle")).toHaveCount(3);
    await expect(scatter).toContainText("1");
  });
});
