import { expect, test, type Page } from "@playwright/test";

/**
 * Right-to-left scripts: direction and justification derive from
 * each block's first strong character (unicode-bidi: plaintext) -
 * an Arabic paragraph right-aligns inside an English document.
 * Direction is typography: it lives in the theme, not the doc.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

interface Edge {
  left: number;
  right: number;
  unicodeBidi: string;
}

async function textEdge(page: Page, selector: string): Promise<Edge | null> {
  return page.evaluate((sel) => {
    const root = document.querySelector("folio-doc")?.shadowRoot;
    const el = root?.querySelector(sel);
    if (!el || !root) return null;
    const text = el.firstChild;
    const p = el as HTMLElement;
    const blockRect = p.getBoundingClientRect();
    let textRect: DOMRect | null = null;
    if (text) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const firstLine = range.getClientRects()[0];
      if (firstLine) textRect = firstLine;
    }
    if (!textRect) return null;
    return {
      left: textRect.left - blockRect.left,
      right: blockRect.right - textRect.right,
      unicodeBidi: getComputedStyle(p).unicodeBidi,
    };
  }, selector);
}

test.describe("right-to-left text", () => {
  test("an Arabic paragraph right-aligns; English stays left", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nمرحبا بكم في التقرير\n\nhello world\n");
    const arabic = await textEdge(page, "article p");
    expect(arabic?.unicodeBidi).toBe("plaintext");
    // The Arabic line hugs the RIGHT edge of its paragraph.
    expect(arabic ? arabic.right : 999).toBeLessThan(5);
    expect(arabic ? arabic.left : 0).toBeGreaterThan(50);
    const english = await textEdge(page, "article p:last-of-type");
    // The English line hugs the LEFT edge.
    expect(english ? english.left : 999).toBeLessThan(5);
  });

  test("an Arabic table cell right-aligns its text", async ({ page }) => {
    await loadDoc(
      page,
      "# T\n\n::: table {#t}\ncolumns:\n  - {name: name, type: text}\ndata:\n  - [مرحبا]\n:::\n",
    );
    const cell = await textEdge(page, 'td[data-row-index="0"]');
    expect(cell?.unicodeBidi).toBe("plaintext");
    // Flush right modulo the cell's own 10px padding.
    expect(cell ? cell.right : 999).toBeLessThan(15);
  });

  test("Arabic prose round-trips through the source view", async ({ page }) => {
    await loadDoc(page, "# تقرير\n\nمرحبا بكم في التقرير\n");
    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("مرحبا بكم في التقرير");
    await page.locator("#btn-view").click();
    await expect(
      page.locator("#the-doc p", { hasText: "مرحبا" }),
    ).toBeVisible();
  });
});
