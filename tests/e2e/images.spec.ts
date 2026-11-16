import { expect, test, type Page } from "@playwright/test";

/**
 * Image blocks (spec: docs/specs/images.md): images embed as data
 * URIs in an image directive, render as generated figures, and are
 * edited through the image inspector - never in place.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await waitForDocument(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

// A real 1x1 red PNG - the smallest valid file the picker accepts.
const RED_DOT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" +
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("image blocks", () => {
  test("the sample document ships an image figure", async ({ page }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image");
    await expect(figure.locator("img")).toBeVisible();
    await expect(figure.locator("img")).toHaveAttribute(
      "alt",
      "Q3 Field Operations cover slide",
    );
    await expect(figure.locator("figcaption")).toContainText(
      "review deck cover",
    );
    // Generated output: the figure is never an editable surface.
    const editable = await figure.evaluate(
      (el) => (el as HTMLElement).isContentEditable,
    );
    expect(editable).toBe(false);
  });

  test("the insert button embeds a picked file and reaches the source", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#image-file").setInputFiles({
      name: "red-dot.png",
      mimeType: "image/png",
      buffer: RED_DOT_PNG,
    });
    // The caret was in the intro paragraph, so the new image
    // lands BEFORE the sample's own image - find it by its alt.
    const img = page.locator('#the-doc figure.folio-image img[alt="red dot"]');
    await expect(img).toHaveCount(1);
    const src = await img.getAttribute("src", { timeout: 5000 });
    expect(src).toMatch(/^data:image\/png;base64,/);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: image {#image-");
    expect(md).toContain('alt: "red dot"');
  });

  test("a photo-sized image does not lock the markdown source view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    // ~4 MB of high-entropy bytes, like a real photo: its base64 splits
    // into >100k "words" at every +/= - spell-marking that line pegs
    // the tab for minutes (it locked up before the token cap).
    const photoBytes = Buffer.alloc(4_000_000);
    for (let i = 0; i < photoBytes.length; i++) photoBytes[i] = i % 251;
    const bigPng = Buffer.concat([RED_DOT_PNG, photoBytes]);
    await page.locator("#image-file").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: bigPng,
    });
    const img = page.locator('#the-doc figure.folio-image img[alt="photo"]');
    await expect(img).toHaveCount(1);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-wrap")).toBeVisible({ timeout: 10_000 });
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("src: data:image/png;base64,");
    // the spell pass runs debounced after the switch - the page must
    // still answer afterwards, and the image line must carry no marks
    // (it locked up before the word/token caps)
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
    await expect(page.locator("#md-wrap")).toBeVisible();
    const marksOnImageLine = await page.evaluate(() => {
      const ln = Array.from(document.querySelectorAll("#md-view .ln")).find(
        (l) => l.textContent?.includes("base64,"),
      );
      return ln ? ln.querySelectorAll(".folio-misspelled").length : -1;
    });
    expect(marksOnImageLine).toBe(0);
  });

  test("a hand-typed Markdown image renders and canonicalizes", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n![A cat](https://example.com/cat.png)");
    const figure = page.locator("#the-doc figure.folio-image");
    await expect(figure.locator("img")).toHaveAttribute("alt", "A cat");
    await expect(figure.locator("img")).toHaveAttribute(
      "src",
      "https://example.com/cat.png",
    );
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: image {#image-1}");
    expect(md).toContain("src: https://example.com/cat.png");
  });

  test("the image inspector edits alt and caption in place", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image").first();
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator(".insp-alt").fill("The all-hands cover");
    await insp.locator(".insp-alt").press("Enter");
    await expect(figure.locator("img")).toHaveAttribute(
      "alt",
      "The all-hands cover",
    );
    await insp.locator(".insp-caption").fill("A new caption");
    await insp.locator(".insp-caption").press("Enter");
    await expect(figure.locator("figcaption")).toHaveText("A new caption");
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain('alt: "The all-hands cover"');
    expect(md).toContain('caption: "A new caption"');
  });

  test("the inspector replaces the image file", async ({ page }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image").first();
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-file").setInputFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: RED_DOT_PNG,
    });
    await expect
      .poll(async () =>
        figure.locator("img").evaluate((el) => (el as HTMLImageElement).src),
      )
      .toMatch(/^data:image\/png;base64,/);
  });

  test("Backspace on a selected image removes the block", async ({ page }) => {
    await waitForDocument(page);
    const count = await page.locator("#the-doc figure.folio-image").count();
    expect(count).toBeGreaterThan(0);
    await page.locator("#the-doc figure.folio-image img").first().click();
    await page.keyboard.press("Backspace");
    await expect(page.locator("#the-doc figure.folio-image")).toHaveCount(
      count - 1,
    );
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).not.toContain(
      "::: image",
    );
  });

  test("the inspector follows the uniform dismissal contract", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image").first();
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(insp).toBeHidden();
  });

  test("an oversized image is refused with a visible message", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("#the-doc figure.folio-image").count();
    await page.locator("#image-file").setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(9 * 1024 * 1024, 1),
    });
    await expect(page.locator("#status")).toContainText("too large");
    await expect(page.locator("#the-doc figure.folio-image")).toHaveCount(
      before,
    );
  });
});
