import { expect, test, type Page } from "@playwright/test";

/**
 * The "Repay or invest?" example (demo/examples/repay-or-invest.md):
 * real open data from 1975, a month-by-month model, and assumptions -
 * start date, term, mortgage type - that drive every figure.
 */

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/repay-or-invest.md");
  await page.locator("#the-doc h1").first().waitFor();
}

/** A labelled table's value: the row whose first cell has `label`. */
const valueOf = (page: Page, table: string, label: string) =>
  page
    .locator(`#the-doc figure[data-table-id="${table}"] tbody tr`, {
      hasText: label,
    })
    .locator("td")
    .nth(1);

/** Type into one assumption cell, then leave it (that recalculates). */
async function assume(page: Page, col: number, text: string): Promise<void> {
  const cell = page
    .locator('#the-doc figure[data-table-id="assume"] tbody td')
    .nth(col);
  await cell.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Tab");
}

test.describe("Repay or invest? example", () => {
  test("round-trips byte for byte", async ({ page }) => {
    const source = await (
      await page.request.get("/demo/examples/repay-or-invest.md")
    ).text();
    await open(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    expect(await page.locator("#editor").inputValue()).toBe(source);
  });

  test("the whole term in the data: repaying ends owing nothing", async ({
    page,
  }) => {
    await open(page);
    await expect(valueOf(page, "check", "Assumptions")).toHaveText("fine");
    await expect(valueOf(page, "period", "Months modelled")).toHaveText("300");
    await expect(valueOf(page, "period", "data does not reach")).toHaveText(
      "0",
    );
    await expect(valueOf(page, "outcome", "Still owed - repaying")).toHaveText(
      "0.00",
    );
    await expect(
      valueOf(page, "outcome", "Still owed - holding the debt"),
    ).toHaveText("200,000.00");
    // The worst moment is found, with its month.
    await expect(
      page
        .locator('#the-doc figure[data-table-id="moments"] tbody tr')
        .first()
        .locator("td")
        .nth(2),
    ).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("a later start stops at the data and says how much is left", async ({
    page,
  }) => {
    await open(page);
    await assume(page, 1, "2010-01-01");
    await expect(valueOf(page, "period", "Months modelled")).toHaveText("201");
    await expect(valueOf(page, "period", "data does not reach")).toHaveText(
      "99",
    );
    await expect(valueOf(page, "period", "First month")).toHaveText(
      "2010-01-31",
    );
  });

  test("the mortgage type changes the answer; an unknown one says so", async ({
    page,
  }) => {
    await open(page);
    const paid = valueOf(page, "outcome", "Paid in total");
    const fixed = await paid.textContent();
    await assume(page, 3, "tracker");
    await expect(paid).not.toHaveText(fixed ?? "");
    await assume(page, 3, "fixed");
    await expect(valueOf(page, "check", "Assumptions")).toContainText(
      "mortgage must be 2-year fix, 5-year fix, tracker or variable",
    );
    // Its sources are cited, each with its retrieval date.
    await expect(page.locator("#the-doc ol.folio-refs li")).toHaveCount(3);
    await expect(page.locator("#the-doc ol.folio-refs")).toContainText(
      "Retrieved 28 October 2026",
    );
  });

  test("paying more each month: repaying clears early, then invests", async ({
    page,
  }) => {
    await open(page);
    await expect(valueOf(page, "period", "loan is cleared in")).toHaveText(
      "2026-09-30",
    );
    // monthly is the seventh assumption: £1,500 a month, both ways.
    await assume(page, 6, "1500");
    await expect(valueOf(page, "outcome", "Paid in total")).toHaveText(
      "450,000.00",
    );
    await expect(valueOf(page, "period", "loan is cleared in")).toHaveText(
      "2017-07-31",
    );
    await expect(
      valueOf(page, "outcome", "Investments - repaying"),
    ).not.toHaveText("0.00");
    // A later start: the loan is not cleared within the data.
    await assume(page, 6, "0");
    await assume(page, 1, "2010-01-01");
    await expect(valueOf(page, "period", "loan is cleared in")).toHaveText(
      "not within the months modelled",
    );
  });

  test("a tracker can start in 1990; a fix cannot, and says why", async ({
    page,
  }) => {
    await open(page);
    await assume(page, 3, "tracker");
    await assume(page, 1, "1990-01-01");
    await expect(valueOf(page, "check", "Assumptions")).toHaveText("fine");
    await expect(valueOf(page, "period", "Months modelled")).toHaveText("300");
    await expect(valueOf(page, "period", "Last month")).toHaveText(
      "2014-12-31",
    );
    const net = page.locator('#the-doc figure[data-chart-source="plan"]', {
      hasText: "Where each choice leaves you",
    });
    await expect(net.locator(".chart-holder svg")).toBeVisible();
    // A 2-year fix from 1990: before its data, so the check says so,
    // and the empty charts explain themselves rather than vanish.
    await assume(page, 3, "2-year fix");
    await expect(valueOf(page, "check", "Assumptions")).toContainText(
      "too early: 2-year fix data begins in January 1995",
    );
    await expect(net.locator(".chart-empty")).toHaveText(
      /^Nothing to show: no rows to plot/,
    );
    // Back to a tracker: the charts draw again.
    await assume(page, 3, "tracker");
    await expect(valueOf(page, "check", "Assumptions")).toHaveText("fine");
    await expect(net.locator(".chart-empty")).toHaveCount(0);
  });
});
