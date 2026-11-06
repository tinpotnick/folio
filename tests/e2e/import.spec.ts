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
    // A file is previewed first (rows, types, names, terms).
    await page.locator("#btn-import-go").click();
    const fig = page.locator('figure[data-table-id="sales"]');
    await expect(fig.locator("tbody tr")).toHaveCount(2);
    await expect(fig.locator('th[data-col-index="1"]')).toHaveText("v");
    // Numeric inference: the source says type: number.
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: table {#sales}");
    expect(md).toContain('import: "sales.csv"');
    // A file without a web address is not cited.
    expect(md).not.toContain("cite:");
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
    // A file is previewed first (rows, types, names, terms).
    await page.locator("#btn-import-go").click();
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
    // A file is previewed first (rows, types, names, terms).
    await page.locator("#btn-import-go").click();
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
    await expect(page.locator("#import-error")).toContainText("Import failed");
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

  test("a SQLite file lists its tables and imports the chosen one", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page
      .locator("#import-file")
      .setInputFiles("demo/data/calls-2026-03.db");
    // Several tables: the dialog lists them all with row counts. The
    // March file also carries litestream's _litestream_* bookkeeping
    // tables - listed under an "Internal tables" group, never hidden.
    await expect(page.locator("#import-sqlite-tables")).toBeVisible();
    await expect(page.locator("#import-sqlite-list label")).toHaveCount(5);
    await expect(page.locator(".import-sqlite-internal")).toContainText(
      "Internal tables",
    );
    await expect(
      page.locator('#import-sqlite-list input[value="cdr"]'),
    ).toBeVisible();
    await page.locator('#import-sqlite-list input[value="cdr"]').check();
    // The preview shows the chosen table's typed columns.
    await expect(page.locator("#import-summary")).toContainText("36 rows");
    await page.locator("#btn-import-go").click();
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    await expect(fig.locator("tbody tr")).toHaveCount(36);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain('import: "calls-2026-03.db#cdr"');
    expect(md).toContain("{name: start_at, type: number}");
    // TEXT columns are not coerced to numbers: the leading zero stays.
    expect(md).toContain("{name: caller_id_number, type: text}");
  });

  test("a gzipped .db.gz (an S3 archive object) imports after transparent gunzip", async ({
    page,
  }) => {
    await waitForDocument(page);
    const { readFileSync } = await import("node:fs");
    const gz = readFileSync("demo/data/calls-2026-03.db.gz");
    await page.locator("#import-file").setInputFiles({
      name: "calls-2026-03.db.gz",
      mimeType: "application/gzip",
      buffer: gz,
    });
    // Decompressed, the table picker appears as for a plain .db.
    await expect(page.locator("#import-sqlite-list label")).toHaveCount(5);
    await page.locator('#import-sqlite-list input[value="cdr"]').check();
    await page.locator("#btn-import-go").click();
    await expect(
      page.locator('figure[data-table-id="calls_2026_03_cdr"] tbody tr'),
    ).toHaveCount(36);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'import: "calls-2026-03.db.gz#cdr"',
    );
  });

  test("a file that is not SQLite is a visible error", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#import-file").setInputFiles({
      name: "fake.db",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("definitely not a database file at all........"),
    });
    await expect(page.locator("#import-error")).toContainText(
      "not a SQLite database file",
    );
  });

  test("refresh from the newer month file updates the table in place", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page
      .locator("#import-file")
      .setInputFiles("demo/data/calls-2026-03.db");
    await page.locator('#import-sqlite-list input[value="cdr"]').check();
    await page.locator("#btn-import-go").click();
    await expect(
      page.locator('figure[data-table-id="calls_2026_03_cdr"] tbody tr'),
    ).toHaveCount(36);
    // Come April: the palette's refresh command, the newer file.
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("refresh imported data");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Refresh imported data from a file");
    await page.keyboard.press("Enter");
    await page
      .locator("#refresh-file")
      .setInputFiles("demo/data/calls-2026-04.db");
    // The confirmation lists the table and both row counts.
    await expect(page.locator("#refresh-modal")).toBeVisible();
    await expect(page.locator("#refresh-list")).toContainText(
      "@calls_2026_03_cdr",
    );
    await expect(page.locator("#refresh-list")).toContainText(
      "36 rows become 48",
    );
    await page.locator("#btn-refresh-go").click();
    // Same table, new data, new provenance.
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    await expect(fig.locator("tbody tr")).toHaveCount(48);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain('import: "calls-2026-04.db#cdr"');
  });

  test("refresh with an unmatched file says so and changes nothing", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page
      .locator("#import-file")
      .setInputFiles("demo/data/calls-2026-03.db");
    await page.locator('#import-sqlite-list input[value="cdr"]').check();
    await page.locator("#btn-import-go").click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("refresh imported data");
    await page.keyboard.press("Enter");
    await page.locator("#refresh-file").setInputFiles({
      name: "unrelated.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("a,b\n1,2\n"),
    });
    await expect(page.locator("#status")).toContainText(
      "No table in this document was imported from",
    );
    await expect(page.locator("#refresh-modal")).toBeHidden();
  });
});

test.describe("imported tables: hidden columns and grouped charts", () => {
  async function importCdr(page: Page): Promise<void> {
    await waitForDocument(page);
    await page
      .locator("#import-file")
      .setInputFiles("demo/data/calls-2026-03.db");
    await page.locator('#import-sqlite-list input[value="cdr"]').check();
    await page.locator("#btn-import-go").click();
    await expect(
      page.locator('figure[data-table-id="calls_2026_03_cdr"] tbody tr'),
    ).toHaveCount(36);
  }

  test("hiding a column removes it from the figure but keeps it in the data", async ({
    page,
  }) => {
    await importCdr(page);
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    // 14 columns rendered, uuid first.
    await expect(fig.locator("thead th")).toHaveCount(14);
    // Click the uuid heading: the inspector opens on that column.
    await fig.locator('th[data-col-index="0"]').click();
    const insp = fig.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await expect(insp.locator(".insp-col")).toHaveValue("0");
    await insp.locator(".insp-visible").uncheck();
    // uuid is gone from the rendered table; 13 columns remain.
    await expect(fig.locator("thead th")).toHaveCount(13);
    await expect(
      fig.locator("thead th .name").filter({ hasText: /^uuid$/ }),
    ).toHaveCount(0);
    // The data is untouched: the source records hidden, the rows keep uuid.
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("{name: uuid, type: text, hidden: true}");
    expect(md).toContain("call-202603-0000");
  });

  test("hide and show columns from the right-click menu - no inspector round-trip", async ({
    page,
  }) => {
    await importCdr(page);
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    await expect(fig.locator("thead th")).toHaveCount(14);
    // Right-click the uuid header: one menu item hides it.
    await fig.locator('th[data-col-index="0"]').click({ button: "right" });
    await page
      .locator(".folio-table-menu button", { hasText: "Hide column 'uuid'" })
      .click();
    await expect(fig.locator("thead th")).toHaveCount(13);
    // And the transcription header.
    await fig.locator('th[data-col-index="13"]').click({ button: "right" });
    await page
      .locator(".folio-table-menu button", {
        hasText: "Hide column 'transcription'",
      })
      .click();
    await expect(fig.locator("thead th")).toHaveCount(12);
    await page.locator("#btn-markdown").click();
    let md = await page.locator("#editor").inputValue();
    expect(md).toContain("{name: uuid, type: text, hidden: true}");
    expect(md).toContain("{name: transcription, type: text, hidden: true}");
    await page.locator("#btn-view").click();
    // Hidden columns have no header, so any cell's menu offers them back.
    await fig
      .locator('td[data-row-index="0"]')
      .first()
      .click({ button: "right" });
    await page
      .locator(".folio-table-menu button", { hasText: "Show column 'uuid'" })
      .click();
    await fig
      .locator('td[data-row-index="0"]')
      .first()
      .click({ button: "right" });
    await page
      .locator(".folio-table-menu button", {
        hasText: "Show column 'transcription'",
      })
      .click();
    await expect(fig.locator("thead th")).toHaveCount(14);
    await page.locator("#btn-markdown").click();
    md = await page.locator("#editor").inputValue();
    expect(md).not.toContain("hidden: true");
  });

  test("the palette command opens the column controls", async ({ page }) => {
    await importCdr(page);
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    await fig.locator('td[data-row-index="0"]').first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("show or hide columns");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Show or hide columns");
    await page.keyboard.press("Enter");
    await expect(fig.locator(".folio-inspector")).toBeVisible();
    await expect(fig.locator(".folio-inspector .insp-visible")).toBeFocused();
  });

  test("a grouped chart: group by hangup_cause, count rows, pie", async ({
    page,
  }) => {
    await importCdr(page);
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    // Chart it from the table's inspector bar.
    await fig.locator('td[data-row-index="0"]').first().click();
    await fig.locator(".insp-chart").click();
    const chart = page.locator('figure[data-chart-source="calls_2026_03_cdr"]');
    await expect(chart.locator("svg")).toBeVisible();
    // Open the chart inspector and group by hangup_cause with a count.
    await chart.locator(".chart-holder").click();
    const insp = chart.locator(".folio-inspector");
    await insp.locator(".insp-group").fill("hangup_cause");
    await insp.locator(".insp-group").press("Enter");
    await insp.locator(".insp-agg").fill("n=count");
    await insp.locator(".insp-agg").press("Enter");
    await insp.locator(".insp-type").selectOption("pie");
    // Two causes in the data: NORMAL_CLEARING and NO_ANSWER.
    await expect(chart.locator("svg")).toContainText("NORMAL_CLEARING");
    await expect(chart.locator("svg")).toContainText("NO_ANSWER");
    // The grouped query is in the source; select derives from it.
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("group: [hangup_cause]");
    expect(md).toContain("agg: {n: count}");
  });

  test("group by two keys then limit: top destinations by billed", async ({
    page,
  }) => {
    await importCdr(page);
    const fig = page.locator('figure[data-table-id="calls_2026_03_cdr"]');
    await fig.locator('td[data-row-index="0"]').first().click();
    await fig.locator(".insp-chart").click();
    const chart = page.locator('figure[data-chart-source="calls_2026_03_cdr"]');
    await chart.locator(".chart-holder").click();
    const insp = chart.locator(".folio-inspector");
    // Multi-key group: day, then destination; sum billed; top 3.
    await insp.locator(".insp-group").fill("hangup_cause, destination_number");
    await insp.locator(".insp-group").press("Enter");
    await insp.locator(".insp-agg").fill("billed=sum(total_billed), n=count");
    await insp.locator(".insp-agg").press("Enter");
    await insp.locator(".insp-sort").fill("billed");
    await insp.locator(".insp-sort").press("Enter");
    await insp.locator(".insp-order").selectOption("desc");
    await insp.locator(".insp-limit").fill("3");
    await insp.locator(".insp-limit").press("Enter");
    // The chart renders the grouped rows (all top groups are
    // NORMAL_CLEARING), and the grouped query is in the source.
    await expect(chart.locator("svg")).toBeVisible();
    await expect(chart.locator("svg")).toContainText("NORMAL_CLEARING");
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("group: [hangup_cause, destination_number]");
    expect(md).toContain("agg: {billed: sum(total_billed), n: count}");
    expect(md).toContain("limit: 3");
  });
});
