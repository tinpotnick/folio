import { expect, test, type Page } from "@playwright/test";

/**
 * Import data › From the web (docs/specs/data-import.md, ADR-0029).
 * The publisher is mocked: the tests never touch the network.
 */

const BOE =
  "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&SeriesCodes=IUMABEDR&CSVF=TN&UsingCodes=Y";
const CSV =
  "DATE,IUMABEDR\n31 Jan 2020,0.75\n29 Feb 2020,0.75\n31 Mar 2020,0.1\n";

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
}

const markdown = async (page: Page): Promise<string> => {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  return page.locator("#editor").inputValue();
};

const today = (): string => {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test.describe("import from the web", () => {
  test("Insert › Import data fetches, previews, and cites the source", async ({
    page,
  }) => {
    await page.route("https://www.bankofengland.co.uk/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/csv",
        headers: { "access-control-allow-origin": "*" },
        body: CSV,
      }),
    );
    await open(page);
    await page.locator("#the-doc p").first().click();
    await page.locator("#btn-insert-menu").click();
    await page.locator("#insert-menu #btn-import-data").click();
    await expect(page.locator("#import-modal")).toBeVisible();
    await page.locator("#import-tab-web").click();
    await page.locator("#import-url").fill(BOE);
    await page.keyboard.press("Enter");
    await expect(page.locator("#import-summary")).toHaveText(
      "3 rows · DATE (date), IUMABEDR (number)",
    );
    await expect(page.locator("#import-sample tbody tr").first()).toHaveText(
      "2020-01-310.75",
    );
    await expect(page.locator("#import-licence")).toContainText(
      "Open Government Licence v3.0",
    );
    await page.locator("#import-caption").fill("Bank Rate (monthly average)");
    await page.locator("#btn-import-go").click();
    await expect(page.locator("#import-modal")).toBeHidden();
    const fig = page.locator("#the-doc figure[data-table-id]").first();
    await expect(fig.locator("figcaption")).toContainText(
      "Bank Rate (monthly average)",
    );
    const year = today().slice(0, 4);
    await expect(fig.locator(".folio-table-source")).toHaveText(
      `Source: Bank of England (${year})`,
    );
    await expect(page.locator("#the-doc ol.folio-refs li")).toHaveText([
      `Bank of England. (${year}). Bank Rate (monthly average) [Data set]. Retrieved ${String(new Date().getDate())} ${new Date().toLocaleString("en-GB", { month: "long" })} ${year}, from ${BOE}`,
    ]);
    const md = await markdown(page);
    expect(md).toContain(`import: "${BOE}"`);
    expect(md).toContain(`retrieved: ${today()}`);
    expect(md).toContain("cite: boe_iumabedr");
    expect(md).toContain("{name: DATE, type: date}");
    expect(md).toContain("  - [2020-01-31, 0.75]");
    expect(md).toContain("@misc{boe_iumabedr,");
    expect(md).toContain(
      "note         = {Licence: Open Government Licence v3.0}",
    );
  });

  test("a site that blocks browsers: download, then choose the file", async ({
    page,
  }) => {
    // The page's fetch is refused, as the real BoE's is (no CORS
    // header - which a mocked response would not enforce).
    await page.route("https://www.bankofengland.co.uk/**", (route) =>
      route.abort("accessdenied"),
    );
    await open(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("import data from the web");
    await page.keyboard.press("Enter");
    await page.locator("#import-url").fill(BOE);
    await page.locator("#btn-import-fetch").click();
    await expect(page.locator("#import-blocked")).toBeVisible();
    await expect(page.locator("#import-open-link")).toHaveAttribute(
      "href",
      BOE,
    );
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#btn-import-downloaded").click();
    await (
      await chooser
    ).setFiles({
      name: "results.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV),
    });
    await expect(page.locator("#import-summary")).toContainText("3 rows");
    await page.locator("#btn-import-go").click();
    // The address, not the file name, is the recorded source.
    expect(await markdown(page)).toContain(`import: "${BOE}"`);
  });

  test("an address that is a web page says so", async ({ page }) => {
    await page.route("https://example.org/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        headers: { "access-control-allow-origin": "*" },
        body: "<!DOCTYPE html><html><body>Our data</body></html>",
      }),
    );
    await open(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("Import data");
    await page.keyboard.press("Enter");
    await page.locator("#import-tab-web").click();
    await page.locator("#import-url").fill("https://example.org/data");
    await page.locator("#btn-import-fetch").click();
    await expect(page.locator("#import-error")).toContainText(
      "returned a web page, not data",
    );
    await expect(page.locator("#btn-import-go")).toBeHidden();
  });

  test("formulas over imported dates: a running mortgage balance", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    await page.locator("#editor").fill(`# Loan

::: table {#loan}
columns:
  - {name: start, type: date}
  - {name: due, type: formula, expr: "edate(start, self.row - 1)"}
  - {name: payment, type: formula, expr: "-pmt(0.045 / 12, 300, 250000) | round(2)"}
  - {name: balance, type: formula, expr: "((self.row == 1 ? 250000 : self.prev.balance) * (1 + 0.045 / 12) - payment) | round(2)"}
data:
  - [2025-01-01, "", "", ""]
  - [2025-01-01, "", "", ""]
:::
`);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    const rows = page.locator('#the-doc figure[data-table-id="loan"] tbody tr');
    await expect(rows.nth(1)).toContainText("2025-02-01");
    await expect(rows.nth(0)).toContainText("1389.58");
    await expect(rows.nth(0)).toContainText("249547.92");
  });

  test("a broken formula breaks its column, not the table", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    await page.locator("#editor").fill(`# Loan

::: table {#loan}
columns:
  - {name: month, type: number}
  - {name: payment, type: formula, expr: "=-PMT(4.5%/12, 25*12, 250000) | round(2)"}
  - {name: oops, type: formula, expr: "VLOOKUP(month, 1, 2)"}
data:
  - [1, "", ""]
  - [2, "", ""]
:::
`);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    const fig = page.locator('#the-doc figure[data-table-id="loan"]');
    // The spreadsheet way of writing it works.
    await expect(fig.locator("tbody tr").first()).toContainText("1389.58");
    // The broken column says so, and only it.
    await expect(fig.locator("tbody tr").first()).toContainText("#ERR");
    const err = fig.locator(".folio-table-error");
    await expect(err).toContainText("unknown function 'VLOOKUP'");
    // The error opens that column's inspector, to fix it there.
    await err.click();
    await expect(fig.locator(".folio-inspector")).toBeVisible();
    await expect(fig.locator(".folio-inspector .insp-col")).toHaveValue("2");
    expect(errors).toEqual([]);
  });

  test("rows and columns: the context menu and the palette add them", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
    await page.goto("/?doc=demo/examples/paper.md");
    const fig = page.locator('#the-doc figure[data-table-id="choices"]');
    await fig.waitFor();
    const headers = fig.locator("thead th");
    const before = await headers.count();
    await fig.locator("tbody td").first().click({ button: "right" });
    await page
      .locator(".folio-menu button", { hasText: "Insert column right" })
      .click();
    await expect(headers).toHaveCount(before + 1);
    await expect(page.locator(".folio-menu")).toHaveCount(0);
    // Again: a second new column gets its own name.
    await fig.locator("tbody td").first().click({ button: "right" });
    await page
      .locator(".folio-menu button", { hasText: "Insert column right" })
      .click();
    await expect(headers).toHaveCount(before + 2);
    await expect(headers.nth(1)).toContainText("new_2");
    // The palette, from a cell.
    const rows = fig.locator("tbody tr");
    const rowCount = await rows.count();
    await fig.locator("tbody td").nth(2).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert a row");
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(rowCount + 1);
  });

  test("search finds the money functions and import", async ({ page }) => {
    await open(page);
    for (const [query, top] of [
      ["pmt", "Table formulas"],
      ["loan payment", "Table formulas"],
      ["vlookup", "Table formulas"],
      ["import", "Import data"],
    ] as const) {
      await page.keyboard.press("Control+k");
      await page.locator("#palette-input").fill(query);
      await expect(page.locator("#palette-list > *").first()).toContainText(
        top,
      );
      await page.keyboard.press("Escape");
    }
  });

  test("Chart it on a time series draws lines over the years", async ({
    page,
  }) => {
    await page.route("https://www.bankofengland.co.uk/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/csv",
        headers: { "access-control-allow-origin": "*" },
        body:
          "DATE,IUMABEDR,IUMBV34\n" +
          Array.from({ length: 60 }, (_, i) => {
            const y = 2015 + Math.floor(i / 12);
            const m = String((i % 12) + 1).padStart(2, "0");
            return `${String(y)}-${m}-01,${String(0.5 + i / 50)},${String(2 + i / 40)}`;
          }).join("\n"),
      }),
    );
    await open(page);
    await page.locator("#the-doc p").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("import data from the web");
    await page.keyboard.press("Enter");
    await page.locator("#import-url").fill(BOE);
    await page.keyboard.press("Enter");
    // A series code is not a name: the caption asks, and columns rename.
    await expect(page.locator("#import-caption")).toHaveValue("");
    await expect(page.locator("#import-caption")).toBeFocused();
    await page
      .locator("#import-caption")
      .fill("Bank Rate and 2-year fixed rate");
    await page
      .locator("#import-sample .import-colname")
      .nth(1)
      .fill("bank rate");
    await page
      .locator("#import-sample .import-colname")
      .nth(2)
      .fill("fixed_2y");
    await page.locator("#btn-import-go").click();
    const fig = page.locator("#the-doc figure[data-table-id]").first();
    await expect(fig.locator("thead")).toContainText("bank_rate");
    await fig.locator("tbody td").first().click();
    await fig.locator(".folio-inspector .insp-chart").click();
    const chart = page.locator("#the-doc figure[data-chart-source]").first();
    await expect(chart.locator("figcaption")).toContainText(
      "Bank Rate and 2-year fixed rate",
    );
    await expect(chart.locator(".x-tick").first()).toHaveText("2015");
    const md = await markdown(page);
    expect(md).toMatch(/select: \[DATE, bank_rate, fixed_2y\]/);
    expect(md).toContain("type: line");
  });
});
