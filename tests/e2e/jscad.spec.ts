import { expect, test, type Page } from "@playwright/test";

/**
 * JSCAD models (spec: docs/specs/jscad-blocks.md, ADR-0020): a
 * ```jscad block is a FIGURE - the model, drawn as a themed SVG from
 * code run in a sealed worker; the code shows only while the header
 * is open.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

const model = (code: string): string => "# T\n\n```jscad\n" + code + "\n```\n";
const CUBE = `const { cuboid } = require('@jscad/modeling').primitives
const main = () => cuboid({ size: [10, 10, 10] })
module.exports = { main }`;

test.describe("JSCAD models", () => {
  test("the sample page draws every model, with no errors", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/3d-models.md");
    const views = page.locator("#the-doc figure.folio-jscad .jscad-view");
    await expect(views).toHaveCount(3);
    await expect(views.locator("svg")).toHaveCount(3, { timeout: 15_000 });
    await expect(page.locator("#the-doc .jscad-error")).toHaveCount(0);
  });

  test("the model is the figure; its code shows on click and redraws as you edit", async ({
    page,
  }) => {
    await loadDoc(page, model(CUBE));
    const fig = page.locator("#the-doc figure.folio-jscad");
    // A cube in the iso view: three visible faces.
    await expect(fig.locator(".jscad-view svg path")).toHaveCount(3, {
      timeout: 10_000,
    });
    await expect(fig.locator("pre.folio-code")).toBeHidden();
    await fig.locator(".jscad-view").click();
    await expect(fig.locator("pre.folio-code")).toBeVisible();
    // Edit: a sphere instead - many more faces.
    await fig.locator("pre.folio-code code").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(
      "\nconst { sphere } = require('@jscad/modeling').primitives\nmodule.exports = { main: () => sphere({ radius: 5, segments: 24 }) }",
    );
    await expect
      .poll(() => fig.locator(".jscad-view svg path").count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(20);
    // Clicking elsewhere hides the code again.
    await page.locator("#the-doc h1").click();
    await expect(fig.locator("pre.folio-code")).toBeHidden();
  });

  test("a broken script says what is wrong, as the figure", async ({
    page,
  }) => {
    await loadDoc(page, model("const x = 1"));
    await expect(page.locator("#the-doc .jscad-error")).toContainText(
      "Model error: no main()",
      { timeout: 10_000 },
    );
  });

  test("an endless loop is stopped after five seconds", async ({ page }) => {
    await loadDoc(
      page,
      model(
        "const main = () => { while (true) {} }\nmodule.exports = { main }",
      ),
    );
    await expect(page.locator("#the-doc .jscad-error")).toContainText(
      "longer than 5 seconds",
      { timeout: 12_000 },
    );
  });

  test("the sandbox has no network", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("example.com")) remote.push(r.url());
    });
    await loadDoc(
      page,
      model(
        "const main = () => { fetch('https://example.com/x'); return require('@jscad/modeling').primitives.cuboid() }\nmodule.exports = { main }",
      ),
    );
    await expect(page.locator("#the-doc .jscad-error")).toContainText(
      "fetch is not a function",
      { timeout: 10_000 },
    );
    expect(remote).toEqual([]);
  });

  test("the header's views and dragging turn the model", async ({ page }) => {
    await loadDoc(page, model(CUBE));
    const fig = page.locator("#the-doc figure.folio-jscad");
    const svg = fig.locator(".jscad-view svg");
    await expect(svg.locator("path")).toHaveCount(3, { timeout: 10_000 });
    await fig.locator(".jscad-view").click();
    await fig.locator("select.jscad-view-pick").selectOption("front");
    await expect(svg.locator("path")).toHaveCount(1);
    const before = await svg.innerHTML();
    const box = await fig.locator(".jscad-view").boundingBox();
    if (!box) throw new Error("no view box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 60,
      box.y + box.height / 2 + 40,
    );
    await page.mouse.up();
    await expect.poll(() => svg.innerHTML()).not.toBe(before);
  });

  test("the palette inserts a starter model", async ({ page }) => {
    await loadDoc(page, "# T\n\nIntro\n");
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("3d model");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc figure.folio-jscad .jscad-view svg"),
    ).toBeVisible({ timeout: 10_000 });
  });

  // Regression (first-contact eval): inserting from an empty line
  // left that empty paragraph behind, above the model.
  test("inserting on an empty line takes that line's place", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nIntro\n");
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("3d model");
    await page.keyboard.press("Enter");
    const kids = await page
      .locator("#the-doc article")
      .evaluate((a) => Array.from(a.children).map((c) => c.tagName));
    expect(kids).toEqual(["H1", "P", "FIGURE"]);
  });
});

test.describe("JSCAD models fed by a dataset", () => {
  const bracket = (page: Page) =>
    page.locator("#the-doc figure.folio-jscad").first();

  test("the header's row picker drives the model and writes row=", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/3d-models.md");
    const fig = bracket(page);
    const svg = fig.locator(".jscad-view svg");
    await expect(svg).toBeVisible({ timeout: 10_000 });
    const before = await svg.innerHTML();
    await fig.locator(".jscad-view").click();
    await fig.getByLabel("Dataset row").selectOption("3");
    await expect
      .poll(() => svg.innerHTML(), { timeout: 10_000 })
      .not.toBe(before);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "```jscad params=@bracket-sizes row=3",
    );
  });

  test("editing the dataset redraws the model", async ({ page }) => {
    await page.goto("/?doc=demo/examples/3d-models.md");
    const svg = bracket(page).locator(".jscad-view svg");
    await expect(svg).toBeVisible({ timeout: 10_000 });
    const before = await svg.innerHTML();
    // medium (row 2) hole radius 3 -> 9
    const cell = page.locator(
      '#the-doc figure[data-table-id="bracket-sizes"] td[data-row-index="1"][data-col-index="3"]',
    );
    await cell.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("9");
    await page.keyboard.press("Tab");
    await expect
      .poll(() => svg.innerHTML(), { timeout: 10_000 })
      .not.toBe(before);
  });

  test("a missing dataset says so, as the figure", async ({ page }) => {
    await loadDoc(page, "# T\n\n```jscad params=@nope\n" + CUBE + "\n```\n");
    await expect(page.locator("#the-doc .jscad-error")).toContainText(
      "no dataset @nope",
      { timeout: 10_000 },
    );
  });

  test("Export STL downloads the drawn model", async ({ page }) => {
    await loadDoc(page, model(CUBE));
    const fig = page.locator("#the-doc figure.folio-jscad");
    await expect(fig.locator(".jscad-view svg")).toBeVisible({
      timeout: 10_000,
    });
    await fig.locator(".jscad-view").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      fig.locator(".jscad-export").click(),
    ]);
    expect(download.suggestedFilename()).toBe("model-1.stl");
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const stl = readFileSync(path, "utf8");
    expect(stl.startsWith("solid model-1")).toBe(true);
    // A cube: 6 faces, 2 triangles each.
    expect(stl.match(/facet normal/g)).toHaveLength(12);
  });
});
