import { expect, test, type Page } from "@playwright/test";

/**
 * Document settings dialog: typed controls over the frontmatter
 * style keys. The YAML stays the source of truth - the dialog only
 * writes through the same parse/serialize pipeline as hand edits.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await waitForDocument(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

function shadowStyleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector("folio-doc")?.shadowRoot;
    const style = root?.querySelector("style");
    return style?.textContent ?? "";
  });
}

async function openSettings(page: Page): Promise<void> {
  await page.locator("#btn-settings").click();
  await expect(page.locator("#settings-modal")).toBeVisible();
}

test.describe("document settings", () => {
  test("the gear button opens the dialog; Cancel and Esc close it", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#btn-settings-cancel").click();
    await expect(page.locator("#settings-modal")).toBeHidden();
    await openSettings(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings-modal")).toBeHidden();
  });

  test("Apply with no changes leaves the source byte-identical", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openSettings(page);
    const before = await page.locator("#editor").inputValue();
    await page.locator("#settings-form button[type=submit]").click();
    await expect(page.locator("#settings-modal")).toBeHidden();
    expect(await page.locator("#editor").inputValue()).toBe(before);
  });

  test("changing the body font writes the style key and re-renders", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-body-font").selectOption("Merriweather");
    await page.locator("#settings-form button[type=submit]").click();
    await expect(page.locator("#settings-modal")).toBeHidden();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /body\.font\.family: "Merriweather"/,
    );
    await page.locator("#btn-view").click();
    const font = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const article = root?.querySelector("article.folio-doc");
      return article ? getComputedStyle(article).fontFamily : "";
    });
    expect(font).toContain("Merriweather");
  });

  test("H1 size reaches the rendered style", async ({ page }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-h1-size").fill("32pt");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /h1\.font\.size: 32pt/,
    );
    expect(await shadowStyleText(page)).toContain("font-size: 32pt");
  });

  test("table style plain switches the table rendering", async ({ page }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-table-style").selectOption("plain");
    await page.locator("#settings-form button[type=submit]").click();
    expect(await shadowStyleText(page)).toContain(
      "border-top: 1px solid #d0d7de",
    );
  });

  test("the H1 page-break setting emits the guarded break rule", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-pb-h1").selectOption("before");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /pagebreak\.h1: "?before"?/,
    );
    expect(await shadowStyleText(page)).toContain(
      "h1:not(:first-child) { break-before: page",
    );
  });

  test("the palette finds Document settings", async ({ page }) => {
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("settings");
    await page.keyboard.press("Enter");
    await expect(page.locator("#settings-modal")).toBeVisible();
  });

  test("Cancel discards edits made in the dialog", async ({ page }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-h2-size").fill("40pt");
    await page.locator("#btn-settings-cancel").click();
    await expect(page.locator("#settings-modal")).toBeHidden();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).not.toMatch(
      /h2\.font\.size: 40pt/,
    );
  });

  test("reopening the dialog shows the applied values", async ({ page }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-palette").selectOption("corporate");
    await page.locator("#settings-form button[type=submit]").click();
    await openSettings(page);
    await expect(page.locator("#set-palette")).toHaveValue("corporate");
    await page.locator("#btn-settings-cancel").click();
  });
});

test.describe("themes", () => {
  test("the dialog lists the shipped themes and switching re-renders", async ({
    page,
  }) => {
    await waitForDocument(page);
    // The sample declares theme: corporate-report - the select
    // honors the document's own frontmatter. (Its charts stay
    // folio-blue: the sample also sets chart.palette: "muted",
    // and a style key always overrides the theme.)
    await page.locator("#btn-settings").click();
    const themeSelect = page.locator("#set-theme");
    await expect(themeSelect).toHaveValue("corporate-report");
    const options = await themeSelect.locator("option").allTextContents();
    expect(options).toContain("default");
    expect(options).toContain("technical");
    expect(options).toContain("editorial");
    await page.locator("#btn-settings-cancel").click();

    // A bare document wears the theme: switch to editorial and
    // the body becomes Georgia 19px, the theme line written.
    await loadDoc(page, "# T\n\nHello\n");
    await page.locator("#btn-settings").click();
    await expect(page.locator("#set-theme")).toHaveValue("default");
    await page.locator("#set-theme").selectOption("editorial");
    await page.locator("#settings-form button[type=submit]").click();
    const font = await page
      .locator("#the-doc p")
      .first()
      .evaluate((el) => getComputedStyle(el));
    expect(font.fontFamily.toLowerCase()).toContain("georgia");
    expect(font.fontSize).toBe("19px");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "theme: editorial",
    );
  });

  test("default removes the theme line; style keys still override", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-theme").selectOption("default");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).not.toContain("theme:");
    // The style keys the sample sets (fonts, table style) survive.
    expect(md).toContain("body.font.family");
  });
});
