import { expect, test, type Page } from "@playwright/test";
import { readThrough } from "./reader";

/**
 * Compute blocks (spec: docs/specs/compute-blocks.md, ADR-0030): a
 * ```python fence with `data=` / `out=` is CODE - it never draws its
 * own tables. `data=@takings` hands the script a dataset; the
 * variables named in `out=` become `@names` (a dataset, or a single
 * value) that charts, formulas and other scripts use, stored in the
 * document right after the block. One line under the code says what
 * the script published, or what went wrong.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return md;
}

const BUDGET = `::: table {#budget}
caption: "Budget"
columns:
  - {name: item, type: text}
  - {name: cost, type: number}
data:
  - [Engineering, 30]
  - [Design, 12]
:::
`;

/** A formula that reads a value: `@total * 2`. */
const DOUBLE = `::: table {#double}
columns:
  - {name: what, type: text}
  - {name: twice, type: formula, expr: "@total * 2"}
data:
  - [Total, ""]
:::
`;

const compute = (info: string, code: string, after = ""): string =>
  `# T\n\n${BUDGET}\n\`\`\`python ${info}\n${code}\n\`\`\`\n\n${after}`;

const block = (page: Page) => page.locator("#the-doc figure.folio-compute");
const status = (page: Page) => block(page).locator(".compute-status");
const T = { timeout: 25_000 };

test.describe("Compute blocks", () => {
  test("the example: code stays code; charts and a formula read its outputs", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
    await page.goto("/?doc=demo/examples/compute.md");
    await expect(block(page)).toHaveCount(2);
    await readThrough(page);
    await expect(status(page).nth(0)).toHaveText(
      /^→ @fit \(14 rows\) · @slope = [\d.]+$/,
      T,
    );
    await expect(status(page).nth(1)).toHaveText("→ @projection (14 rows)", T);
    // The code is the block - no output tables of its own.
    await expect(block(page).first().locator("pre.folio-code")).toBeVisible();
    await expect(page.locator("#the-doc .compute-table")).toHaveCount(0);
    await expect(page.locator("#the-doc .folio-computed")).toHaveCount(3);
    await expect(page.locator("#the-doc .folio-computed").first()).toBeHidden();
    // Charts over the outputs, and a formula over @slope.
    await expect(
      page.locator('#the-doc figure[data-chart-source="fit"] svg'),
    ).toBeVisible();
    await expect(
      page.locator('#the-doc figure[data-chart-source="projection"] svg'),
    ).toBeVisible();
    await expect(
      page.locator('#the-doc figure[data-table-id="growth"] tbody tr').first(),
    ).toContainText(/\d+\.\d\d/);
  });

  test("a value: published, read bare by a formula, stored in the document", async ({
    page,
  }) => {
    await loadDoc(
      page,
      compute(
        "data=@budget out=total",
        `total = sum(budget.col("cost"))`,
        DOUBLE,
      ),
    );
    await expect(status(page)).toHaveText("→ @total = 42", T);
    await expect(
      page.locator('#the-doc figure[data-table-id="double"] td').nth(1),
    ).toHaveText("84");
    const md = await source(page);
    expect(md).toContain(
      '```python data=@budget out=total\ntotal = sum(budget.col("cost"))\n```\n\n::: value {#total}\ncomputed: python\nvalue: 42\n:::',
    );
  });

  test("editing the code runs it again, and its readers follow", async ({
    page,
  }) => {
    await loadDoc(
      page,
      compute(
        "data=@budget out=total",
        `scale = 1\ntotal = sum(r["cost"] for r in budget) * scale`,
        DOUBLE,
      ),
    );
    await expect(status(page)).toHaveText("→ @total = 42", T);
    const code = await block(page).locator("pre.folio-code code").boundingBox();
    if (!code) throw new Error("no code");
    await page.mouse.click(code.x + 3, code.y + 5);
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("2");
    await expect(status(page)).toHaveText("→ @total = 84", T);
    await expect(
      page.locator('#the-doc figure[data-table-id="double"] td').nth(1),
    ).toHaveText("168");
  });

  test("editing the data runs it again", async ({ page }) => {
    await loadDoc(
      page,
      compute("data=@budget out=total", `total = sum(budget.col("cost"))`),
    );
    await expect(status(page)).toHaveText("→ @total = 42", T);
    const cell = page.locator(
      '#the-doc figure[data-table-id="budget"] td[data-row-index="0"][data-col-index="1"]',
    );
    await cell.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("50");
    await page.keyboard.press("Tab");
    await expect(status(page)).toHaveText("→ @total = 62", T);
  });

  test("a dataset output opens in the dataset browser", async ({ page }) => {
    await loadDoc(
      page,
      compute(
        "data=@budget out=costly",
        `costly = [r for r in budget if r["cost"] > 20]`,
      ),
    );
    await expect(status(page)).toHaveText("→ @costly (1 row)", T);
    await status(page).getByRole("button", { name: "@costly" }).click();
    await expect(page.locator("#the-doc .folio-ds-panel")).toContainText(
      "Engineering",
    );
  });

  test("errors say what is wrong, under the code", async ({ page }) => {
    await loadDoc(
      page,
      compute("data=@budget out=total", "x = 1\ntotal = 1 / 0"),
    );
    await expect(status(page)).toHaveText(
      "Compute error: ZeroDivisionError: division by zero (line 2)",
      T,
    );
    await expect(block(page).locator("pre.folio-code")).toBeVisible();
  });

  test("a variable that cannot be published, or was never set, says so", async ({
    page,
  }) => {
    await loadDoc(page, compute("data=@budget out=xs", "xs = [1, 2]"));
    await expect(status(page)).toContainText("xs is a list", T);
    await loadDoc(page, compute("data=@budget out=nope", "x = 1"));
    await expect(status(page)).toContainText(
      "out= names nope, but the script never sets it",
      T,
    );
  });

  test("an output may not reuse a name the document has", async ({ page }) => {
    await loadDoc(page, compute("out=budget", "budget = 1"));
    await expect(status(page)).toContainText(
      "@budget is already used in this document",
      T,
    );
  });

  test("a missing dataset says so", async ({ page }) => {
    await loadDoc(page, compute("data=@nope out=x", "x = 1"));
    await expect(status(page)).toContainText("no dataset @nope", T);
  });

  test("an endless loop is stopped after ten seconds", async ({ page }) => {
    await loadDoc(page, compute("data=@budget out=x", "while True:\n    pass"));
    await expect(status(page)).toContainText("longer than 10 seconds", {
      timeout: 30_000,
    });
  });

  test("the sandbox has no network", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("example.com")) remote.push(r.url());
    });
    await loadDoc(
      page,
      compute(
        "data=@budget out=x",
        `import urllib.request\nurllib.request.urlopen("https://example.com/x")\nx = 1`,
      ),
    );
    await expect(status(page)).toContainText("Compute error", T);
    expect(remote).toEqual([]);
  });

  test("a plain python fence is inert code", async ({ page }) => {
    await loadDoc(page, "# T\n\n```python\nprint('hello')\n```\n");
    await expect(block(page)).toHaveCount(0);
    await expect(page.locator("#the-doc pre.folio-code code")).toHaveText(
      "print('hello')",
    );
  });

  test("the header binds a dataset, then publishes a ticked variable", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `# T\n\n${BUDGET}\n\`\`\`python\nanswer = len(budget)\n\`\`\`\n`,
    );
    const fig = page.locator("#the-doc figure.folio-codeblock");
    await fig.locator("pre.folio-code code").click();
    await fig.getByLabel("Input dataset").selectOption("budget");
    // It runs, publishes nothing yet, and offers what it could.
    await expect(status(page)).toContainText(
      "name the variables to publish",
      T,
    );
    await block(page).locator("pre.folio-code code").click();
    // (Ticking re-renders the block, so click - check() would wait on
    // the old box.)
    await block(page).getByRole("checkbox", { name: "answer" }).click();
    await expect(status(page)).toHaveText("→ @answer = 2", T);
    expect(await source(page)).toContain("```python data=@budget out=answer");
  });

  test("the palette inserts a starter that publishes", async ({ page }) => {
    await loadDoc(page, `# T\n\n${BUDGET}\n`);
    await page.locator("#the-doc h1").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("compute python");
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText("→ @budget_rows = 2", T);
  });

  test("stored outputs draw the charts even when Python cannot load", async ({
    page,
  }) => {
    await page.route("**/pyodide/**", (route) => route.abort());
    await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
    await page.goto("/?doc=demo/examples/compute.md");
    await page.locator("#the-doc h1").first().waitFor();
    await readThrough(page);
    await expect(
      page.locator('#the-doc figure[data-chart-source="fit"] svg'),
    ).toBeVisible();
    await expect(
      page.locator('#the-doc figure[data-chart-source="projection"] svg'),
    ).toBeVisible();
    await expect(status(page).first()).toContainText(
      "could not load the Python runtime",
      T,
    );
  });
});
