import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end coverage of the demo host page (index.html + src/main.ts)
 * against the sample document (demo/sample-document.md). Playwright
 * locators pierce the open shadow root of <folio-doc>, so component
 * internals are addressed with plain CSS selectors.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

test.describe("document view", () => {
  test("renders the sample document with table and chart", async ({ page }) => {
    await waitForDocument(page);
    const doc = page.locator("folio-doc article.folio-doc");
    await expect(
      doc.locator("h2", { hasText: "Regional summary" }),
    ).toBeVisible();
    await expect(doc.locator("figure table").first()).toBeVisible();
    await expect(doc.locator("figure svg[role='img']").first()).toBeVisible();
  });

  test("web degradation: native Open/Save stay hidden", async ({ page }) => {
    await waitForDocument(page);
    await expect(page.locator("#btn-open")).toBeHidden();
    await expect(page.locator("#btn-save")).toBeHidden();
    await expect(page.locator("#btn-help")).toBeVisible();
  });

  test("Table button inserts a table block and confirms via status", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("folio-doc figure table").count();
    await page.locator("#btn-table").click();
    await expect(
      page.locator("#status", { hasText: "Table inserted" }),
    ).toBeVisible();
    await expect(page.locator("folio-doc figure table")).toHaveCount(
      before + 1,
    );
  });
});

test.describe("markdown source view", () => {
  test("shows highlighted source with a line-number gutter", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#the-doc")).toBeHidden();

    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("# Q3 Field Operations Review");
    expect(source).toContain("---");

    await expect(
      page.locator("#md-view span.tk-heading", {
        hasText: "# Q3 Field Operations Review",
      }),
    ).toBeVisible();
    await expect(
      page
        .locator("#md-view span.tk-frontmatter-delim", { hasText: "---" })
        .first(),
    ).toBeVisible();

    const gutter = await page.locator("#md-gutter").textContent();
    expect(gutter?.split("\n").slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  test("edited source round-trips back into the rendered view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await page
      .locator("#editor")
      .fill("# Edited heading\n\nFresh paragraph.\n");
    await page.locator("#btn-view").click();

    await expect(
      page.locator("#status", { hasText: "Parsed OK" }),
    ).toBeVisible();
    await expect(
      page.locator("folio-doc h1", { hasText: "Edited heading" }),
    ).toBeVisible();
    await expect(
      page.locator("folio-doc p", { hasText: "Fresh paragraph." }),
    ).toBeVisible();
    await expect(page.locator("#editor")).toBeHidden();
  });

  test("invalid source reports a parse error and stays in source view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill("::: table {#broken}\nnot a table\n");
    await page.locator("#btn-view").click();

    await expect(page.locator("#status")).toContainText("Parse error");
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#the-doc")).toBeHidden();
  });
});

test.describe("section browser", () => {
  test("lists every heading and reveals the clicked section", async ({
    page,
  }) => {
    await waitForDocument(page);
    const sidebar = page.locator("#sidebar");
    await expect(sidebar).toBeHidden();
    await page.locator("#btn-sidebar").click();
    await expect(sidebar).toBeVisible();

    const outline = page.locator("#outline button");
    await expect(outline).toHaveCount(2);
    await expect(outline.first()).toHaveText("Q3 Field Operations Review");
    await expect(outline.nth(1)).toHaveText("Regional summary");

    await outline.nth(1).click();
    const focused = await page.evaluate(() => {
      const host = document.querySelector("folio-doc");
      return host?.shadowRoot?.activeElement?.textContent ?? "";
    });
    expect(focused).toContain("Regional summary");
  });

  test("Sections button toggles the sidebar", async ({ page }) => {
    await waitForDocument(page);
    const sidebar = page.locator("#sidebar");

    await page.locator("#btn-sidebar").click();
    await expect(sidebar).toBeVisible();

    await page.locator("#btn-sidebar").click();
    await expect(sidebar).toBeHidden();
  });
});

test.describe("edits keep the document the single source of truth", () => {
  test("typing in document view syncs the Markdown source", async ({
    page,
  }) => {
    await waitForDocument(page);

    const intro = page.locator("folio-doc p", { hasText: "Revenue recovered" });
    await intro.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" (updated)");

    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("(updated)");
  });
});

test.describe("in-app help", () => {
  test("Help button opens the help document; Close dismisses it", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();

    const modal = page.locator("#help-modal");
    await expect(modal).toBeVisible();
    await expect(
      page.locator("#help-doc h1", { hasText: "folio help" }),
    ).toBeVisible();
    await expect(page.locator("#help-doc figure table").first()).toBeVisible();
    await expect(
      page.locator("#help-doc p", { hasText: "copy the source" }),
    ).toBeVisible();

    await page.locator("#btn-help-close").click();
    await expect(modal).toBeHidden();
  });

  test("Esc closes the help window", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await expect(page.locator("#help-modal")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#help-modal")).toBeHidden();
  });

  test("? and F1 open help; not while typing in the source editor", async ({
    page,
  }) => {
    await waitForDocument(page);
    const modal = page.locator("#help-modal");

    await page.keyboard.press("?");
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("F1");
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    await page.locator("#btn-markdown").click();
    await page.locator("#editor").click();
    await page.keyboard.press("?");
    await expect(modal).toBeHidden();
  });
});
