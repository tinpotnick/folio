import { expect, test, type Page } from "@playwright/test";

/**
 * A model follows the row being edited (docs/specs/jscad-blocks.md,
 * "Follows the row"): click into a row of its dataset and the model
 * draws that row; an edit redraws it when the cell is left.
 */
async function open(page: Page, doc = "demo/examples/3d-models.md") {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto(`/?doc=${doc}`);
  await page.locator("#the-doc h1").first().waitFor();
}

const cell = (page: Page, r: number, c: number) =>
  page.locator(
    `#the-doc figure[data-table-id="bracket-sizes"] td[data-row-index="${r}"][data-col-index="${c}"]`,
  );
const model = (page: Page) =>
  page.locator("#the-doc figure.folio-jscad").first();
/** The drawing, as a fingerprint that changes when the model does. */
const drawing = (page: Page) =>
  model(page)
    .locator(".jscad-view svg")
    .evaluate((s) => s.innerHTML.length);

async function fence(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return md.split("\n").find((l) => l.startsWith("```jscad")) ?? "";
}

test.describe("a model follows the row being edited", () => {
  test("clicking a row shows it; leaving an edited cell redraws it", async ({
    page,
  }) => {
    await open(page);
    await expect(model(page).locator(".jscad-view svg")).toBeVisible();
    const medium = await drawing(page);

    // Row 3 (large): the model switches to it, and is saved so.
    await cell(page, 2, 1).click();
    await expect.poll(() => drawing(page)).not.toBe(medium);
    expect(await fence(page)).toBe("```jscad params=@bracket-sizes row=3");
    const large = await drawing(page);

    // Typing alone redraws nothing; leaving the cell does.
    await cell(page, 2, 1).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("150");
    expect(await drawing(page)).toBe(large);
    await page.keyboard.press("Tab");
    await expect.poll(() => drawing(page)).not.toBe(large);

    // Row 1: the default, so the fence drops row=.
    await cell(page, 0, 1).click();
    await expect.poll(() => fence(page)).toBe("```jscad params=@bracket-sizes");
  });

  test("two models on one table keep their own rows", async ({ page }) => {
    const doc = [
      "# T",
      "",
      "::: table {#sizes}",
      "columns:",
      "  - {name: size, type: text}",
      "  - {name: length, type: number}",
      "data:",
      "  - [small, 20]",
      "  - [large, 60]",
      ":::",
      "",
      "```jscad params=@sizes",
      "const { cuboid } = require('@jscad/modeling').primitives",
      "const main = ({ length }) => cuboid({ size: [length, 10, 10] })",
      "module.exports = { main }",
      "```",
      "",
      "```jscad params=@sizes row=2",
      "const { cuboid } = require('@jscad/modeling').primitives",
      "const main = ({ length }) => cuboid({ size: [length, 10, 10] })",
      "module.exports = { main }",
      "```",
      "",
    ].join("\n");
    await open(page, "demo/welcome.md");
    await page.evaluate(
      (src) =>
        (
          document.querySelector("#the-doc") as unknown as {
            load(s: string): Promise<void>;
          }
        ).load(src),
      doc,
    );
    await page
      .locator('#the-doc figure[data-table-id="sizes"] td[data-row-index="1"]')
      .first()
      .click();
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("```jscad params=@sizes\n");
    expect(md).toContain("```jscad params=@sizes row=2\n");
  });
});
