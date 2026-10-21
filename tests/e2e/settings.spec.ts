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
    await page.locator("#set-body-font").selectOption("Literata");
    await page.locator("#settings-form button[type=submit]").click();
    await expect(page.locator("#settings-modal")).toBeHidden();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /body\.font\.family: "?Literata"?/,
    );
    await page.locator("#btn-view").click();
    const font = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const article = root?.querySelector("article.folio-doc");
      return article ? getComputedStyle(article).fontFamily : "";
    });
    expect(font).toContain("Literata");
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
      "table.folio-table td, table.folio-table th { border: 1px solid var(--folio-rule); }",
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
  const card = (page: Page, name: string) =>
    page.locator(`#set-theme .theme-card[data-theme="${name}"]`);

  test("the picker shows the ten themes as cards; picking one re-renders", async ({
    page,
  }) => {
    await waitForDocument(page);
    // The sample declares theme: corporate-report - the picker
    // honors the document's own frontmatter.
    await openSettings(page);
    await expect(page.locator("#set-theme .theme-card")).toHaveCount(10);
    await expect(card(page, "corporate-report").locator("input")).toBeChecked();
    // Each card previews its theme: the sample wears its face.
    const sampleFont = await card(page, "editorial")
      .locator(".tc-sample")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(sampleFont).toContain("Fraunces");
    await page.locator("#btn-settings-cancel").click();

    // A bare document wears the theme: pick Editorial and the body
    // becomes Literata 18px, the theme line written.
    await loadDoc(page, "# T\n\nHello\n");
    await openSettings(page);
    await expect(card(page, "default").locator("input")).toBeChecked();
    await card(page, "editorial").click();
    // The override fields name what the picked theme gives.
    await expect(
      page.locator('#set-body-font option[value="default"]'),
    ).toHaveText("Theme default (Literata)");
    await expect(page.locator("#set-body-size")).toHaveAttribute(
      "placeholder",
      "18px",
    );
    await page.locator("#settings-form button[type=submit]").click();
    const font = await page
      .locator("#the-doc p")
      .first()
      .evaluate((el) => getComputedStyle(el));
    expect(font.fontFamily).toContain("Literata");
    expect(font.fontSize).toBe("18px");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "theme: editorial",
    );
  });

  test("Folio removes the theme line; style keys still override", async ({
    page,
  }) => {
    await waitForDocument(page);
    await openSettings(page);
    await page.locator("#set-table-style").selectOption("plain");
    await card(page, "default").click();
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).not.toContain("theme:");
    expect(md).toContain("table.style");
  });

  test("overrides are counted and Reset to theme clears them", async ({
    page,
  }) => {
    await loadDoc(
      page,
      '---\ntheme: swiss\nstyle:\n  body.font.family: "Literata"\n  h2.font.size: 30pt\n---\n\n# T\n\nHello\n',
    );
    await openSettings(page);
    await expect(page.locator("#settings-override-note")).toHaveText(
      "2 settings override the theme",
    );
    await page.locator("#btn-settings-reset").click();
    await expect(page.locator("#settings-override-note")).toHaveText(
      "none - the theme decides",
    );
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("theme: swiss");
    expect(md).not.toContain("style:");
  });

  test("the palette's Change theme opens the picker", async ({ page }) => {
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("theme");
    await page
      .locator("#palette-list .palette-item", { hasText: "Change theme" })
      .first()
      .click();
    await expect(page.locator("#settings-modal")).toBeVisible();
    await expect(card(page, "corporate-report").locator("input")).toBeFocused();
  });
});
