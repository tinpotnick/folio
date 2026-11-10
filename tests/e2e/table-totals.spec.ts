import { expect, test } from "@playwright/test";

/**
 * Totals rows (spec: docs/specs/table-totals.md): a `totals:` section
 * on a dataset renders a derived <tfoot> ("Total" + computed cells,
 * column-formatted), recomputes on cell edits, and is never data
 * (charts/queries exclude it).
 */

test.describe("table totals rows", () => {
  test("the invoice example shows a totals footer and recomputes on edit", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/invoice.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-table-id="invoice"]');
    await fig.scrollIntoViewIfNeeded();
    // formula column computed per row: 2*450, 12*620, 1*900
    const amounts = fig.locator("tbody td.folio-formula");
    await expect(amounts.nth(0)).toHaveText(/900/);
    await expect(amounts.nth(1)).toHaveText(/7,?440/);
    // the totals row
    const foot = fig.locator("tfoot tr.folio-totals");
    await expect(foot).toHaveCount(1);
    await expect(foot.locator("td").first()).toHaveText("Total");
    const cells = foot.locator("td");
    await expect(cells.nth(1)).toHaveText("15"); // qty sum
    await expect(cells.nth(3)).toHaveText(/9,?240/); // amount sum, currency-formatted
    // footer cells are not editable
    await expect(foot.locator("td[contenteditable='true']")).toHaveCount(0);
    // edit a qty: 12 -> 20; line amount and totals update in place
    await page
      .locator(
        '#the-doc figure[data-table-id="invoice"] td[data-row-index="1"][data-col-index="1"]',
      )
      .click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("20");
    await page.keyboard.press("Tab");
    await expect(fig.locator("tbody td.folio-formula").nth(1)).toHaveText(
      /12,?400/,
    );
    await expect(foot.locator("td").nth(1)).toHaveText("23");
    await expect(foot.locator("td").nth(3)).toHaveText(/14,?200/);
    // the chart on the same table plots only the 3 line items
    const bars = page.locator(
      '#the-doc figure[data-chart-id="spend"] .bar, #the-doc figure[data-chart-id="spend"] rect',
    );
    expect(await bars.count()).toBeGreaterThanOrEqual(3);
  });

  test("a totals expr error is a visible error line, not a crash", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/invoice.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toHaveValue(/totals:/);
    await page
      .locator("#editor")
      .fill(
        (await page.locator("#editor").inputValue()).replace(
          'expr: "self.col.qty | sum()"',
          'expr: "self.row"',
        ),
      );
    await page.locator("#btn-view").click();
    await expect(
      page.locator(
        '#the-doc figure[data-table-id="invoice"] .folio-table-error',
      ),
    ).toContainText(/Totals error:.*no current row/);
    // the table itself still renders
    await expect(
      page.locator('#the-doc figure[data-table-id="invoice"] tbody tr'),
    ).toHaveCount(3);
  });
});
