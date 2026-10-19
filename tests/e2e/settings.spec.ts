import { expect, test, type Page } from "@playwright/test";

/**
 * Document settings dialog: typed controls over the frontmatter
 * style keys. The YAML stays the source of truth - the dialog only
 * writes through the same parse/serialize pipeline as hand edits.
 */

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
