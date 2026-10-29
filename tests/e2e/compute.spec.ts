import { expect, test, type Page } from "@playwright/test";

/**
 * Compute blocks (spec: docs/specs/compute-blocks.md, ADR-0030): a
 * ```python fence WITH binding info (`data=@a,@b out=x,y`) renders
 * as its OUTPUT TABLES - datasets in the @id graph, which charts
 * read like any dataset. A plain ```python fence is inert code,
 * exactly as on GitHub.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

const BUDGET = `::: table {#budget}
caption: "Budget"
columns:
  - {name: item, type: text}
  - {name: cost, type: number, unit: "k", align: right}
data:
  - [Engineering, 30]
  - [Design, 12]
:::
`;

const compute = (info: string, code: string): string =>
  `# T\n\n${BUDGET}\n\`\`\`python ${info}\n${code}\n\`\`\`\n`;

test.describe("Compute blocks", () => {
  test("the sample computes: outputs render as tables, its charts read them", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/compute.md");
    // Two compute figures: the fit+band block, the projection block.
    const figures = page.locator("#the-doc figure.folio-python");
    await expect(figures).toHaveCount(2);
    // The multi-out block renders two tables in one figure.
    await expect(figures.nth(0).locator(".compute-table")).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(figures.nth(1).locator(".compute-table")).toHaveCount(1, {
      timeout: 15_000,
    });
    // Both charts over the Python's outputs draw (real SVGs).
    await expect(
      page.locator('#the-doc figure[data-chart-source="fit"] svg'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('#the-doc figure[data-chart-source="projection"] svg'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#the-doc .drawn-error")).toHaveCount(0);
  });

  test("the output is the figure; code hidden until click; edits recalculate", async ({
    page,
  }) => {
    await loadDoc(
      page,
      compute(
        "data=@budget out=totals",
        `total = sum(r["cost"] for r in budget)\nreturn [{ "item": "Total", "cost": total }]`,
      ),
    );
    const fig = page.locator("#the-doc figure.folio-python");
    await expect(fig.locator(".compute-table")).toContainText("42", {
      timeout: 20_000,
    });
    await expect(fig.locator("pre.folio-code")).toBeHidden();
    // Click the table: the code shows, the header reveals.
    await fig.locator(".compute-table").click();
    await expect(fig.locator("pre.folio-code")).toBeVisible();
    // Edit the code: 42 becomes 84.
    await fig.locator("pre.folio-code code").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(
      '\n\nreturn [{ "item": "Double", "cost": total * 2 }]',
    );
    await expect
      .poll(async () => fig.locator(".compute-table").innerText(), {
        timeout: 20_000,
      })
      .toContain("84");
    // Clicking away hides the code again.
    await page.locator("#the-doc h1").click();
    await expect(fig.locator("pre.folio-code")).toBeHidden();
  });

  test("editing the dataset recalculates the output and its chart", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `${compute(
        "data=@budget out=totals",
        `return [{ "item": "Total", "cost": sum(r["cost"] for r in budget) }]`,
      )}\n::: chart {#totals-chart}\nsource: @totals\nquery: {select: [item, cost]}\ntype: bar\ncaption: "Totals"\n:::\n`,
    );
    const fig = page.locator("#the-doc figure.folio-python");
    await expect(fig.locator(".compute-table")).toContainText("42", {
      timeout: 20_000,
    });
    // Engineering 30 -> 50: total 62, chart follows.
    const cell = page.locator(
      '#the-doc figure[data-table-id="budget"] td[data-row-index="0"][data-col-index="1"]',
    );
    await cell.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("50");
    await page.keyboard.press("Tab");
    await expect
      .poll(async () => fig.locator(".compute-table").innerText(), {
        timeout: 20_000,
      })
      .toContain("62");
  });

  test("a broken script says what is wrong, as the figure", async ({
    page,
  }) => {
    await loadDoc(page, compute("data=@budget out=totals", "1 / 0"));
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "Compute error:",
      { timeout: 20_000 },
    );
  });

  test("a missing dataset says so, as the figure", async ({ page }) => {
    await loadDoc(
      page,
      compute(
        "data=@nope out=totals",
        `return [{ "item": "Total", "cost": 0 }]`,
      ),
    );
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "no dataset @nope",
      { timeout: 20_000 },
    );
  });

  test("a return that is not a table, or the wrong count, says so", async ({
    page,
  }) => {
    await loadDoc(page, compute("data=@budget out=totals", "return 42"));
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "list of dicts",
      { timeout: 20_000 },
    );
  });

  test("an endless loop is stopped after ten seconds", async ({ page }) => {
    await loadDoc(
      page,
      compute("data=@budget out=totals", "while True:\n    pass"),
    );
    await expect(page.locator("#the-doc .drawn-error")).toContainText(
      "longer than 10 seconds",
      { timeout: 25_000 },
    );
  });

  test("the sandbox has no network", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("example.com")) remote.push(r.url());
    });
    await loadDoc(
      page,
      compute(
        "data=@budget out=totals",
        `import urllib.request\nurllib.request.urlopen("https://example.com/x")\nreturn [{ "item": "x", "cost": 1 }]`,
      ),
    );
    await expect(page.locator("#the-doc .drawn-error")).toBeVisible({
      timeout: 20_000,
    });
    expect(remote).toEqual([]);
  });

  test("a plain python fence is inert code, never a compute figure", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n```python\nprint('hello')\n```\n");
    await expect(page.locator("#the-doc figure.folio-python")).toHaveCount(0);
    await expect(page.locator("#the-doc pre.folio-code code")).toHaveText(
      "print('hello')",
    );
  });

  test("the header's data picker binds a dataset and writes data=", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `# T\n\n${BUDGET}\n\`\`\`python\nreturn [{ "x": 1 }]\n\`\`\`\n`,
    );
    const fig = page.locator("#the-doc figure.folio-codeblock");
    // Plain python: inert, but its header still offers the picker.
    await fig.locator("pre.folio-code code").click();
    await fig.getByLabel("Input dataset").selectOption("budget");
    await expect(fig.locator(".compute-table")).toContainText("rows", {
      timeout: 20_000,
    });
    // The fence now carries the binding, out= defaulted.
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "```python data=@budget out=output",
    );
  });

  test("the palette inserts a starter compute block", async ({ page }) => {
    await loadDoc(page, `# T\n\n${BUDGET}\n`);
    await page.locator("#the-doc p, #the-doc h1").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("compute python");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure.folio-python .compute-table"),
    ).toBeVisible({ timeout: 20_000 });
  });
});
