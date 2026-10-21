import { expect, test, type Page } from "@playwright/test";

/**
 * Data import (spec: docs/specs/data-import.md): a picked CSV or
 * JSON file becomes a typed table INSIDE the document - the
 * import snapshot - with its provenance in `import:`. Never a
 * live binding (ADR-0005).
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

test.describe("data import", () => {
  test("a CSV file becomes a typed table with provenance", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#import-file").setInputFiles({
      name: "sales.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("region,v\nNorth,412\nSouth,388\n"),
    });
    const fig = page.locator('figure[data-table-id="sales"]');
    await expect(fig.locator("tbody tr")).toHaveCount(2);
    await expect(fig.locator('th[data-col-index="1"]')).toHaveText("v");
    // Numeric inference: the source says type: number.
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: table {#sales}");
    expect(md).toContain('import: "sales.csv"');
    expect(md).toContain("{name: v, type: number}");
    expect(md).toContain("- [North, 412]");
  });

  test("a JSON array of objects imports the same way", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#import-file").setInputFiles({
      name: "metrics.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '[{"month":"Jul","total":190},{"month":"Aug","total":210}]',
      ),
    });
    await expect(
      page.locator('figure[data-table-id="metrics"] tbody tr'),
    ).toHaveCount(2);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'import: "metrics.json"',
    );
  });

  test("a 2,000-row import is a viewport table, not a freeze", async ({
    page,
  }) => {
    await waitForDocument(page);
    const csv = [
      "region,v",
      ...Array.from(
        { length: 2000 },
        (_, i) => `Region ${String(i)},${String(i)}`,
      ),
    ].join("\n");
    await page.locator("#import-file").setInputFiles({
      name: "big.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    const fig = page.locator('figure[data-table-id="big"]');
    await expect(fig.locator("tbody tr")).toHaveCount(50);
    await expect(fig.locator(".folio-table-more")).toContainText("2,000 rows");
    // The dataset browser handles the full set.
    await fig.locator(".ds-open").click();
    await expect(page.locator(".folio-ds-count")).toContainText("2,000 rows");
    await page.locator(".folio-ds-filter").fill("v > 1997");
    await expect(page.locator(".folio-ds-count")).toContainText(
      "2 rows of 2,000",
    );
  });

  test("an invalid file is a visible error, not a broken document", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("#the-doc figure").count();
    await page.locator("#import-file").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not json"),
    });
    await expect(page.locator("#status")).toContainText("Import failed");
    await expect(page.locator("#the-doc figure")).toHaveCount(before);
  });

  test("the palette finds the import command", async ({ page }) => {
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("import data from a file");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Import data from a file");
  });
});
