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
      `Bank of England. (${year}). Bank Rate (monthly average) [Data set]. Licence: Open Government Licence v3.0. Retrieved ${String(new Date().getDate())} ${new Date().toLocaleString("en-GB", { month: "long" })} ${year}, from ${BOE}`,
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

  test("open data: a publisher and series, named and cited", async ({
    page,
  }) => {
    // OECD sends CORS headers: a browser page fetches it directly.
    await page.route("https://sdmx.oecd.org/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/vnd.sdmx.data+csv",
        headers: { "access-control-allow-origin": "*" },
        body: [
          "STRUCTURE,STRUCTURE_ID,REF_AREA,Reference area,MEASURE,Measure,TIME_PERIOD,OBS_VALUE",
          "DATAFLOW,X,GBR,United Kingdom,SHARE,Share prices,1999-12,90",
          "DATAFLOW,X,GBR,United Kingdom,SHARE,Share prices,2000-01,95.5",
          "DATAFLOW,X,GBR,United Kingdom,SHARE,Share prices,2000-02,97.25",
        ].join("\n"),
      }),
    );
    await open(page);
    await page.locator("#the-doc p").first().click();
    await page.locator("#btn-insert-menu").click();
    await page.locator("#insert-menu #btn-import-data").click();
    await page.locator("#import-tab-known").click();
    await page.locator("#import-pub").selectOption("oecd");
    await expect(page.locator("#import-pub-about")).toContainText("CC BY 4.0");
    await page
      .locator("#import-series label", {
        hasText: "United Kingdom share prices",
      })
      .click();
    await page.locator("#import-from").fill("2000");
    await page.locator("#btn-import-known").click();
    // Named by the catalogue, from the year asked for.
    await expect(page.locator("#import-summary")).toHaveText(
      "2 rows · date (date), uk_shares (number)",
    );
    await expect(page.locator("#import-caption")).toHaveValue(
      "United Kingdom share prices (index, 2015 = 100)",
    );
    await expect(page.locator("#import-licence")).toContainText(
      "Share price indices exclude dividends",
    );
    await page.locator("#btn-import-go").click();
    const md = await markdown(page);
    expect(md).toContain("::: table {#uk_shares}");
    expect(md).toContain('licence: "CC BY 4.0"');
    expect(md).toContain("cite: oecd_uk_shares");
    expect(md).toContain("  - [2000-01-01, 95.5]");
    expect(md).not.toContain("1999-12-01");
  });

  test("a downloaded file, marked personal use: on the table, its chart and export", async ({
    page,
  }) => {
    await open(page);
    await page.locator("#the-doc p").first().click();
    await page.locator("#import-file").setInputFiles({
      name: "VUKG.L.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date,Open,Close\n2024-01-01,40.1,40.6\n2024-02-01,40.6,41.2\n",
      ),
    });
    await expect(page.locator("#import-origin")).toBeVisible();
    // No address yet: nothing to cite.
    await expect(page.locator("#import-cite")).toBeDisabled();
    await page
      .locator("#import-origin")
      .fill("https://finance.example.com/quote/VUKG.L/history");
    await expect(page.locator("#import-cite")).toBeEnabled();
    await page.locator("#import-caption").fill("VUKG price history");
    await page.locator("#import-personal").check();
    await page.locator("#btn-import-go").click();
    const fig = page.locator("#the-doc figure[data-table-id]").first();
    await expect(fig.locator(".folio-table-source")).toContainText(
      "Personal use only - not for sharing",
    );
    await fig.locator("tbody td").first().click();
    await fig.locator(".folio-inspector .insp-chart").click();
    await expect(
      page.locator("#the-doc figure[data-chart-source] .folio-personal"),
    ).toHaveText("Personal use only - not for sharing");
    const md = await markdown(page);
    expect(md).toContain(
      'import: "https://finance.example.com/quote/VUKG.L/history"',
    );
    expect(md).toContain('licence: "personal-use"');
    expect(md).toContain(
      "note         = {Licence: personal use only, not for redistribution}",
    );
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    await page.evaluate(() => {
      window.print = (): void => undefined;
    });
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("Export as PDF");
    await page.keyboard.press("Enter");
    await expect(page.locator("#status")).toContainText(
      "This document contains personal-use data (VUKG price history)",
    );
  });

  test("open data: several Bank of England series in one table", async ({
    page,
  }) => {
    let asked = "";
    await page.route("https://www.bankofengland.co.uk/**", (route) => {
      asked = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: "application/csv",
        headers: { "access-control-allow-origin": "*" },
        body: [
          "SERIES,DESCRIPTION",
          "IUMABEDR,Monthly average of official Bank Rate",
          "IUMBV34,Monthly interest rate ... 2 year (75% LTV) fixed rate mortgage",
          "",
          "DATE,IUMABEDR,IUMBV34",
          "31 Jan 2024,5.25,4.71",
          "29 Feb 2024,5.25,4.76",
        ].join("\n"),
      });
    });
    await open(page);
    await page.locator("#the-doc p").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("Import data");
    await page.keyboard.press("Enter");
    await page.locator("#import-tab-known").click();
    // Bank of England is first; Bank Rate is ticked; add the 2-year fix.
    await page
      .locator("#import-series label", { hasText: "2-year fixed" })
      .click();
    await page.locator("#import-from").fill("2024");
    await page.locator("#btn-import-known").click();
    await expect(page.locator("#import-summary")).toHaveText(
      "2 rows · date (date), bank_rate (number), fixed_2y (number)",
    );
    expect(asked).toContain("SeriesCodes=IUMABEDR,IUMBV34&CSVF=TT");
    expect(asked).toContain("Datefrom=01/Jan/2024");
    await expect(page.locator("#import-caption")).toHaveValue(
      "Bank Rate (monthly average); 2-year fixed mortgage rate (75% LTV)",
    );
    await page.locator("#btn-import-go").click();
    const md = await markdown(page);
    // A few series: named after them; their unit in the header.
    expect(md).toContain("::: table {#bank_rate_fixed_2y}");
    expect(md).toContain("cite: boe_bank_rate_fixed_2y");
    expect(md).toContain('{name: bank_rate, type: number, unit: "%"}');
  });

  test("after an import the caret follows the table: the next one, and a chart", async ({
    page,
  }) => {
    await open(page);
    await page.locator("#the-doc p").first().click();
    for (const name of ["first.csv", "second.csv"]) {
      await page.locator("#import-file").setInputFiles({
        name,
        mimeType: "text/csv",
        buffer: Buffer.from("d,v\n2024-01-01,1\n2024-02-01,2\n"),
      });
      await page.locator("#btn-import-go").click();
    }
    const ids = await page
      .locator("#the-doc figure[data-table-id]")
      .evaluateAll((f) => f.map((x) => (x as HTMLElement).dataset.tableId));
    expect(ids).toEqual(["first", "second"]);
    // Chart from a dataset finds the table just imported.
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("Insert a chart");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure[data-chart-source]"),
    ).toHaveCount(1);
    // The palette reaches Open data by what people look for.
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("mortgage rates");
    await expect(page.locator("#palette-list > *").first()).toContainText(
      "Import open data",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator("#import-tab-known")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
