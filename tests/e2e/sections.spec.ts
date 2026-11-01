import { expect, test, type Page } from "@playwright/test";

/** Section browser (spec: docs/specs/section-browser-and-highlighting.md). */

async function openWithSections(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/sales-review.md");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-sidebar").click();
}

function headingTop(page: Page, text: string): Promise<number> {
  return page.evaluate((text) => {
    const root = document.querySelector("#the-doc")?.shadowRoot;
    for (const h of Array.from(root?.querySelectorAll("h1, h2") ?? [])) {
      if (h.textContent?.trim() === text) return h.getBoundingClientRect().top;
    }
    return Number.NaN;
  }, text);
}

test.describe("section browser", () => {
  test("a jump lands the heading below the toolbar, with no focus box", async ({
    page,
  }) => {
    await openWithSections(page);
    await page.locator("#outline button", { hasText: "Product mix" }).click();
    const header = await page
      .locator("header")
      .evaluate((h) => h.getBoundingClientRect().bottom);
    // Settled just below the toolbar: not under it, not far below.
    await expect
      .poll(async () => {
        const top = await headingTop(page, "Product mix");
        return top > header && top < header + 40;
      })
      .toBe(true);
    const outline = await page.evaluate(() => {
      const root = document.querySelector("#the-doc")?.shadowRoot;
      const h = Array.from(root?.querySelectorAll("h2") ?? []).find(
        (x) => x.textContent?.trim() === "Product mix",
      );
      return h ? getComputedStyle(h).outlineStyle : "";
    });
    expect(outline).toBe("none");
  });

  test("the active entry follows jumps and scrolling", async ({ page }) => {
    await openWithSections(page);
    const active = page.locator("#outline button.active");
    await page
      .locator("#outline button", { hasText: "Against target" })
      .click();
    await expect(active).toHaveText("Against target");
    // The last section cannot scroll to the top; the click still wins.
    await page.locator("#outline button", { hasText: "Next quarter" }).click();
    await expect(active).toHaveText("Next quarter");
    await page.locator("#outline button", { hasText: "Summary" }).click();
    await expect(active).toHaveText("Summary");
    // Reading on: scrolling past a heading moves the mark.
    await page.waitForTimeout(800);
    const y = await page.evaluate(() => window.scrollY);
    const top = await headingTop(page, "Revenue by region");
    await page.evaluate((to) => window.scrollTo(0, to), y + top - 100);
    await expect(active).toHaveText("Revenue by region");
  });

  test("the mark follows reading before any click, to the very end", async ({
    page,
  }) => {
    await openWithSections(page);
    const active = page.locator("#outline button.active");
    await expect(page.locator("#btn-sidebar")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const y = await page.evaluate(() => window.scrollY);
    const top = await headingTop(page, "Product mix");
    await page.evaluate((to) => window.scrollTo(0, to), y + top - 100);
    await expect(active).toHaveText("Product mix");
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(active).toHaveText("Next quarter");
  });

  test("a jump puts the caret in the heading; the toolbar says H2", async ({
    page,
  }) => {
    await openWithSections(page);
    await page.locator("#outline button", { hasText: "Pipeline" }).click();
    await expect(
      page.locator('#block-bar button[data-block="h2"]'),
    ).toHaveClass(/active/);
    await page.keyboard.type("Sales ");
    await expect(
      page.locator("#the-doc h2", { hasText: "Sales Pipeline" }),
    ).toBeVisible();
  });

  test("the sidebar sits flush under the toolbar as the page scrolls", async ({
    page,
  }) => {
    await openWithSections(page);
    const label = page.locator("#sidebar h2");
    const before = await label.evaluate((h) => h.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(100);
    expect(await label.evaluate((h) => h.getBoundingClientRect().top)).toBe(
      before,
    );
  });

  test("the sidebar uses the toolbar's ink, not an accent blue", async ({
    page,
  }) => {
    await openWithSections(page);
    await page.locator("#outline button", { hasText: "Summary" }).click();
    const [color, text] = await page
      .locator("#outline button.active")
      .evaluate((b) => [
        getComputedStyle(b).color,
        getComputedStyle(document.body).color,
      ]);
    expect(color).toBe(text);
  });

  test("Ctrl+P prints", async ({ page }) => {
    await openWithSections(page);
    await page.evaluate(() => {
      (window as unknown as { printed: number }).printed = 0;
      window.print = () => {
        (window as unknown as { printed: number }).printed += 1;
      };
    });
    await page.keyboard.press("Control+p");
    // printDocument is async (it draws lazy figures before printing).
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { printed: number }).printed),
      )
      .toBe(1);
  });
});
