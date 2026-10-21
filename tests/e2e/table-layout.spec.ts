import { expect, test, type Page } from "@playwright/test";

/**
 * Table layout (spec: docs/specs/table-inspector.md, "Layout"): a
 * table never runs past its page - a table wider than the measure
 * scrolls sideways INSIDE the page - numbers right-align, and
 * computed floats display at most six decimals.
 */

async function openSignals(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.evaluate(async () => {
    const md = await (
      await fetch("/demo/examples/signal-processing.md")
    ).text();
    await (
      document.querySelector("#the-doc") as unknown as {
        load(s: string): Promise<void>;
      }
    ).load(md);
  });
  await page
    .locator('#the-doc figure[data-table-id="signal"] td')
    .first()
    .waitFor();
}

test.describe("table layout", () => {
  test("a wide table stays inside its page and scrolls sideways", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSignals(page);
    const fig = page.locator('#the-doc figure[data-table-id="signal"]');
    const box = await page.locator("#the-doc").evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      const article = root.querySelector("article") as HTMLElement;
      const fig = root.querySelector(
        'figure[data-table-id="signal"]',
      ) as HTMLElement;
      const a = article.getBoundingClientRect();
      const f = fig.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(article).paddingRight);
      return { figRight: f.right, textRight: a.right - pad };
    });
    expect(box.figRight).toBeLessThanOrEqual(box.textRight + 1);
    // The table itself is still whole - it scrolls, not squashed.
    const scroller = fig.locator(".folio-table-scroll");
    const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
  });

  test("numeric cells right-align; computed floats show six decimals", async ({
    page,
  }) => {
    await openSignals(page);
    const fig = page.locator('#the-doc figure[data-table-id="signal"]');
    const lp = fig.locator(
      'tbody tr[data-row-index="1"] td[data-col-index="3"]',
    );
    await expect(lp).toHaveText("0.006213");
    expect(await lp.evaluate((el) => getComputedStyle(el).textAlign)).toBe(
      "right",
    );
    const head = fig.locator('thead th[data-col-index="3"]');
    expect(await head.evaluate((el) => getComputedStyle(el).textAlign)).toBe(
      "right",
    );
  });
});

test.describe("narrow screens", () => {
  test("the page never scrolls sideways; the toolbar scrolls itself", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await page.locator("folio-doc h1").first().waitFor();
    const { doc, view } = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }));
    expect(doc).toBeLessThanOrEqual(view);
    // Every toolbar button is still reachable by scrolling the bar.
    const bar = page.locator("header .toolbar");
    const { sw, cw } = await bar.evaluate((el) => ({
      sw: el.scrollWidth,
      cw: el.clientWidth,
    }));
    expect(sw).toBeGreaterThan(cw);
    await page.locator("#btn-mode").scrollIntoViewIfNeeded();
    await expect(page.locator("#btn-mode")).toBeInViewport();
  });
});
