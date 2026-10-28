import { expect, test, type Page } from "@playwright/test";

/**
 * The chart readout (docs/specs/chart-readout.md): point at a chart, tap
 * it, or focus it and use the arrow keys, and the values at the nearest
 * x show beside a guide. A reading aid: nothing changes, nothing prints.
 */

async function open(page: Page, doc: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto(`/?doc=${doc}`);
  await page.locator("#the-doc h1").first().waitFor();
}

const holdChart = (page: Page) =>
  page.locator('#the-doc figure[data-chart-source="plan"]').nth(1);

test.describe("chart readout", () => {
  test("pointing at a line chart reads every series at that month", async ({
    page,
  }) => {
    await open(page, "demo/examples/repay-or-invest.md");
    const chart = holdChart(page);
    await chart.scrollIntoViewIfNeeded();
    const panel = chart.locator(".chart-readout");
    await expect(panel).toBeHidden();
    const box = await chart.locator(".chart-holder svg").boundingBox();
    if (!box) throw new Error("no chart");
    // The first month: the left of the plot.
    await page.mouse.move(box.x + box.width * 0.12, box.y + box.height / 2);
    await expect(panel).toBeVisible();
    await expect(panel.locator(".readout-head")).toHaveText(/\d+ \w{3} \d{4}/);
    await expect(panel.locator(".readout-row")).toHaveCount(2);
    // Money in its column's format: two places, thousands separators.
    await expect(panel.locator(".readout-row b").first()).toHaveText(
      /^£[\d,]+\.\d\d$/,
    );
    // The guide (a zero-width line) and a dot on each series.
    await expect(chart.locator(".readout-layer")).not.toHaveCSS(
      "display",
      "none",
    );
    await expect(chart.locator(".readout-dot").first()).toBeVisible();
    await page.mouse.move(box.x + box.width / 2, box.y - 60);
    await expect(panel).toBeHidden();
  });

  test("the arrow keys step through the months; Esc puts it away", async ({
    page,
  }) => {
    await open(page, "demo/examples/repay-or-invest.md");
    const chart = holdChart(page);
    const holder = chart.locator(".chart-holder");
    await holder.focus();
    const head = chart.locator(".chart-readout .readout-head");
    // Focus starts at the latest month.
    await expect(head).toHaveText("30 Sep 2026");
    await page.keyboard.press("ArrowLeft");
    await expect(head).toHaveText("31 Aug 2026");
    await page.keyboard.press("Home");
    await expect(head).toHaveText("31 Oct 2001");
    // Screen readers hear it.
    await expect(chart.locator(".readout-live")).toContainText("31 Oct 2001:");
    await page.keyboard.press("Escape");
    await expect(chart.locator(".chart-readout")).toBeHidden();
  });

  test("a click still opens the chart's inspector; print shows no readout", async ({
    page,
  }) => {
    await open(page, "demo/examples/repay-or-invest.md");
    const chart = holdChart(page);
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.locator(".chart-holder svg").boundingBox();
    if (!box) throw new Error("no chart");
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(chart.locator(".folio-inspector")).toBeVisible();
    await expect(chart.locator(".chart-readout")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(chart.locator(".chart-readout")).toBeHidden();
    await expect(chart.locator(".readout-layer")).toBeHidden();
  });

  test("single-series line and bar charts read too", async ({ page }) => {
    await open(page, "demo/examples/sales-review.md");
    const charts = page.locator("#the-doc figure[data-chart-source]");
    const count = await charts.count();
    let read = 0;
    for (let i = 0; i < count; i++) {
      const chart = charts.nth(i);
      if ((await chart.locator(".chart-holder svg").count()) === 0) continue;
      const holder = chart.locator(".chart-holder");
      if ((await holder.getAttribute("data-readout")) !== "1") continue;
      await holder.focus();
      await expect(
        chart.locator(".chart-readout .readout-row").first(),
      ).toBeVisible();
      read += 1;
    }
    expect(read).toBeGreaterThan(0);
  });
});

test.describe("chart readout: from the first-contact eval", () => {
  test("it goes when the pointer leaves, even with the caret in the text", async ({
    page,
  }) => {
    await open(page, "demo/examples/repay-or-invest.md");
    await page.locator("#the-doc h2").first().click();
    const chart = holdChart(page);
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.locator(".chart-holder svg").boundingBox();
    if (!box) throw new Error("no chart");
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await expect(chart.locator(".chart-readout")).toBeVisible();
    await page.mouse.move(box.x + box.width * 0.4, box.y - 80);
    await expect(chart.locator(".chart-readout")).toBeHidden();
  });

  test("values carry their unit; PageDown moves a year", async ({ page }) => {
    await open(page, "demo/examples/repay-or-invest.md");
    // Figure 1: Bank Rate and mortgage rates, a "%" unit.
    const rates = page.locator('#the-doc figure[data-chart-source="rates"]');
    await rates.locator(".chart-holder").focus();
    await expect(
      rates.locator(".chart-readout .readout-row b").first(),
    ).toHaveText(/^\d+(\.\d{1,2})?%$/);
    // Money: £, two places.
    const hold = holdChart(page);
    await hold.locator(".chart-holder").focus();
    await page.keyboard.press("Home");
    await expect(
      hold.locator(".chart-readout .readout-row b").first(),
    ).toHaveText(/^£[\d,]+\.\d\d$/);
    await page.keyboard.press("PageDown");
    await expect(hold.locator(".chart-readout .readout-head")).toHaveText(
      "31 Oct 2002",
    );
  });

  test("months read as months; a narrow chart keeps its panel inside", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await open(page, "demo/examples/report.md");
    const chart = page.locator("#the-doc figure[data-chart-source]").first();
    const holder = chart.locator(".chart-holder");
    await holder.focus();
    await expect(chart.locator(".chart-readout .readout-head")).toHaveText(
      /^[A-Z][a-z]{2} \d{4}$/,
    );
    const panel = await chart.locator(".chart-readout").boundingBox();
    const hb = await holder.boundingBox();
    if (!panel || !hb) throw new Error("no box");
    expect(panel.x).toBeGreaterThanOrEqual(hb.x - 1);
    expect(panel.x + panel.width).toBeLessThanOrEqual(hb.x + hb.width + 1);
  });

  test("grouped bars: a dot on each series' own bar", async ({ page }) => {
    await open(page, "demo/examples/sales-review.md");
    const chart = page.locator("#the-doc figure[data-chart-source]", {
      hasText: "Target and actual by region",
    });
    await chart.locator(".chart-holder").focus();
    await expect(chart.locator(".readout-band")).toBeVisible();
    const xs = await chart
      .locator(".readout-dot")
      .evaluateAll((d) => d.map((c) => Number(c.getAttribute("cx"))));
    expect(xs.length).toBeGreaterThan(1);
    expect(new Set(xs).size).toBe(xs.length);
  });
});

test.describe("chart readout on touch", () => {
  test.use({ hasTouch: true });
  test("a tap shows the readout", async ({ page }) => {
    await open(page, "demo/examples/repay-or-invest.md");
    const chart = holdChart(page);
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.locator(".chart-holder svg").boundingBox();
    if (!box) throw new Error("no chart");
    await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2);
    await expect(chart.locator(".chart-readout")).toBeVisible();
  });
});
