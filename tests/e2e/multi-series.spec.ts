import { expect, test } from "@playwright/test";

/** Several series (spec: docs/specs/chart-rendering.md). */

test.describe("charts with several series", () => {
  test("series: region draws a line per region, with a legend", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/report.md");
    const fig = page
      .locator("#the-doc figure")
      .filter({
        has: page.locator(".chart-legend"),
      })
      .first();
    await expect(fig.locator(".legend-item")).toHaveText([
      "North",
      "South",
      "Midlands",
    ]);
    expect(await fig.locator("svg polyline").count()).toBe(3);
  });

  test("two value columns draw grouped bars; Stack stacks them", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/accounts.md");
    const fig = page.locator('#the-doc figure[data-chart-source="pl"]').filter({
      has: page.locator(".chart-legend"),
    });
    await expect(fig.locator(".legend-item")).toHaveText(["h1", "h2"]);
    await expect(fig.locator("svg rect")).toHaveCount(6);
    // The bar's Stack box writes `stack: true`.
    await fig.click();
    await fig.getByLabel("Stack").check();
    await expect(
      fig.locator("svg text.v-label", { hasText: "913" }),
    ).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "query: {select: [region, h1, h2]}\ntype: bar\nstack: true",
    );
  });

  test("Split by in the chart bar writes series:", async ({ page }) => {
    await page.goto("/?doc=demo/examples/report.md");
    const fig = page.locator("#the-doc figure[data-chart-source]", {
      has: page.locator("figcaption", { hasText: "North region revenue" }),
    });
    await fig.click();
    await fig.getByLabel("Split by").selectOption("region");
    await expect(fig.locator(".legend-item")).toHaveCount(1); // filtered: North only
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'type: line\nseries: region\ncaption: "North region revenue',
    );
  });
});
