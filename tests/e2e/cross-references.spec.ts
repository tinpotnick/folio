import { expect, test, type Page } from "@playwright/test";

/** Numbered captions and cross-references (docs/specs/cross-references.md). */

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/sales-review.md");
  await page.locator("#the-doc h1").first().waitFor();
}

const labels = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(
      document
        .querySelector("#the-doc")
        ?.shadowRoot?.querySelectorAll<HTMLElement>("figcaption[data-label]") ??
        [],
    ).map((f) => f.dataset.label ?? ""),
  );

test.describe("cross-references", () => {
  test("captions are numbered in order; references read their numbers", async ({
    page,
  }) => {
    await open(page);
    await expect
      .poll(() => labels(page))
      .toEqual([
        "Table 1",
        "Figure 1",
        "Table 2",
        "Figure 2",
        "Table 3",
        "Figure 3",
      ]);
    await expect(page.locator("#the-doc a.folio-xref")).toHaveText([
      "Table 1",
      "Figure 1",
      "Against target",
    ]);
  });

  test("Insert › Cross-reference picks a table and inserts its number", async ({
    page,
  }) => {
    await open(page);
    const para = page.locator("#the-doc p", {
      hasText: "Monthly revenue, one line",
    });
    await para.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Compare ");
    await page.locator("#btn-insert-menu").click();
    await page.locator("#insert-menu #btn-insert-xref").click();
    await expect(page.locator("#palette-input")).toHaveValue(
      "Cross-reference: ",
    );
    await page.locator("#palette-input").fill("Cross-reference: Table 2");
    await page.keyboard.press("Enter");
    await expect(para).toContainText("Compare Table 2");
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    expect(await page.locator("#editor").inputValue()).toContain(
      "Compare @tbl:product-mix",
    );
  });

  test("numbers follow changes: a new captioned table renumbers the rest", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    const editor = page.locator("#editor");
    const md = await editor.inputValue();
    await editor.fill(
      md.replace(
        "## Revenue by region",
        '::: table {#early}\ncaption: "An earlier table"\ncolumns:\n  - {name: a, type: text}\ndata:\n  - [x]\n:::\n\n## Revenue by region',
      ),
    );
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    await expect(page.locator("#the-doc a.folio-xref").first()).toHaveText(
      "Table 2",
    );
  });

  test("a reference to a missing id says so; clicking a reference goes there", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await open(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    const editor = page.locator("#editor");
    await editor.fill(
      (await editor.inputValue()).replace(
        "## Summary",
        "See @tbl:nope and @tbl:targets.\n\n## Summary",
      ),
    );
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    const refs = page
      .locator("#the-doc p", { hasText: "See" })
      .first()
      .locator("a.folio-xref");
    await expect(refs.first()).toHaveText("table ?");
    await expect(refs.first()).toHaveClass(/folio-xref-missing/);
    const targetTable = page.locator(
      '#the-doc figure[data-table-id="targets"]',
    );
    await expect(targetTable).not.toBeInViewport();
    await refs.nth(1).click();
    await expect(targetTable).toBeInViewport();
  });

  test("inserted right after a word, a reference gets its space", async ({
    page,
  }) => {
    await open(page);
    const para = page.locator("#the-doc p", {
      hasText: "Monthly revenue, one line",
    });
    await para.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Compare");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("Cross-reference: Table 3");
    await page.keyboard.press("Enter");
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    expect(await page.locator("#editor").inputValue()).toContain(
      "Compare @tbl:targets",
    );
  });
});
