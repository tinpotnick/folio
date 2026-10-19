import { expect, test, type Page } from "@playwright/test";

/**
 * Links (spec: docs/specs/links.md): standard [label](url) inline
 * Markdown; clicking follows the link (document links load in
 * place, external URLs open a new tab); the toolbar's link button
 * links a selection and its floating control edits or removes.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

test.describe("links", () => {
  test("the sample document links the other examples", async ({ page }) => {
    await waitForDocument(page);
    const links = page.locator("#the-doc a");
    await expect(links).toHaveCount(4);
    await expect(links.first()).toHaveAttribute(
      "href",
      "demo/examples/poem.md",
    );
  });

  test("clicking a document link opens it in place", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#the-doc a", { hasText: "pure-prose poem" }).click();
    await expect(
      page.locator("folio-doc h1", { hasText: "Ozymandias" }),
    ).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "# Ozymandias",
    );
  });

  test("the link button links a selection and the control edits it", async ({
    page,
  }) => {
    await waitForDocument(page);
    const p = page.locator("folio-doc p", { hasText: "Revenue recovered" });
    await p.click();
    await page.keyboard.press("Control+a");
    // Select a few words of the paragraph (drag over "Revenue").
    await page.locator("folio-doc p").first().click();
    const sel = await p.evaluate(() => {
      const el = document.querySelector("folio-doc");
      const root = el?.shadowRoot as ShadowRoot;
      const node = root.querySelectorAll("p")[0];
      if (!node) return false;
      const range = document.createRange();
      range.setStart(node.firstChild ?? node, 0);
      range.setEnd(node.firstChild ?? node, 7);
      const s = (
        root as ShadowRoot & { getSelection?: () => Selection | null }
      ).getSelection?.();
      s?.removeAllRanges();
      s?.addRange(range);
      return true;
    });
    expect(sel).toBe(true);
    await page.locator("#btn-link").click();
    const menu = page.locator(".folio-link-menu");
    await expect(menu).toBeVisible();
    await menu.locator(".link-url").fill("demo/examples/accounts.md");
    await menu.locator(".link-apply").click();
    // The linked text is now a document link that opens.
    await expect(
      page.locator("#the-doc a", { hasText: "Revenue" }),
    ).toHaveAttribute("href", "demo/examples/accounts.md");
    await page.locator("#the-doc a", { hasText: "Revenue" }).click();
    await expect(
      page.locator("folio-doc h1", {
        hasText: "Half-year management accounts",
      }),
    ).toBeVisible();
  });

  test("the control removes a link, keeping the text", async ({ page }) => {
    await waitForDocument(page);
    await page
      .locator("folio-doc a", { hasText: "pure-prose poem" })
      .click({ position: { x: 2, y: 2 } });
    // The click OPENED the linked document; go back to the sample.
    await page.goto("/");
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    // Put the caret inside a link by selecting its text.
    await page
      .locator("folio-doc a", { hasText: "pure-prose poem" })
      .evaluate((node) => {
        const el = document.querySelector("folio-doc");
        const root = el?.shadowRoot as ShadowRoot;
        const s = (
          root as ShadowRoot & { getSelection?: () => Selection | null }
        ).getSelection?.();
        const range = document.createRange();
        if (node) range.selectNodeContents(node);
        s?.removeAllRanges();
        s?.addRange(range);
        return true;
      });
    await page.locator("#btn-link").click();
    const menu = page.locator(".folio-link-menu");
    await expect(menu).toBeVisible();
    await menu.locator(".link-remove").click();
    await expect(
      page.locator("#the-doc a", { hasText: "pure-prose poem" }),
    ).toHaveCount(0);
    await expect(
      page.locator("folio-doc p", { hasText: "pure-prose poem" }),
    ).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).not.toContain("poem.md");
  });

  test("external URLs open in a new tab", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill("# T\n\nSee [the site](https://example.com/).");
    await page.locator("#btn-view").click();
    const popup = page.waitForEvent("popup");
    await page.locator("#the-doc a", { hasText: "the site" }).click();
    const tab = await popup;
    expect(tab.url()).toContain("example.com");
  });
});
