import { expect, test, type Page } from "@playwright/test";

/**
 * Slideshow (docs/specs/slides.md): play toggles a slide-rendering
 * flag on the document view (one slide per H1, full DOM) plus
 * fullscreen. The file is never changed by presenting.
 */

const DECK = [
  "# Alpha",
  "",
  "- one",
  "- two",
  "",
  "# Beta",
  "",
  "Just a sentence.",
  "",
  "## A sub heading",
  "",
  "More prose under an H2 - same slide.",
  "",
  "# Gamma",
  "",
  "![pic](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)",
  "",
].join("\n");

async function loadDeck(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(DECK);
  await page.locator("#btn-view").click();
  await expect(
    page.locator("folio-doc h1", { hasText: "Alpha" }),
  ).toBeVisible();
}

async function slideHeads(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("folio-doc")?.shadowRoot;
    return Array.from(
      root?.querySelectorAll("article.folio-doc > h1") ?? [],
    ).map((h) => (h as HTMLElement).textContent);
  });
}

test.describe("slideshow", () => {
  test("play toggles slide rendering on the document view", async ({
    page,
  }) => {
    await loadDeck(page);
    await expect(page.locator("folio-doc")).not.toHaveAttribute("slides", /.*/);
    await page.locator("#btn-play").click();
    await expect(page.locator("folio-doc")).toHaveAttribute("slides", /.*/);
    // Full DOM, no windowing: every H1 is in the article at once.
    expect(await slideHeads(page)).toEqual(["Alpha", "Beta", "Gamma"]);
    await page.locator("#btn-play").click();
    await expect(page.locator("folio-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("palette offers Play slideshow / Stop slideshow", async ({ page }) => {
    await loadDeck(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("play");
    await expect(
      page.locator("#palette-modal .palette-item", {
        hasText: "Play slideshow",
      }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("folio-doc")).toHaveAttribute("slides", /.*/);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("stop");
    await expect(
      page.locator("#palette-modal .palette-item", {
        hasText: "Stop slideshow",
      }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("folio-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("one slide per H1; H2 never splits; counter reads n of N", async ({
    page,
  }) => {
    await loadDeck(page);
    await page.locator("#btn-play").click();
    await expect(page.locator("#status")).toContainText("Slide 1 of 3");
    const heads = await slideHeads(page);
    expect(heads).toHaveLength(3);
    // H2 stays inside slide Beta.
    await expect(
      page.locator("folio-doc h2", { hasText: "A sub heading" }),
    ).toBeVisible();
  });

  test("arrow keys advance and clamp at the last slide; Esc stops", async ({
    page,
  }) => {
    await loadDeck(page);
    await page.locator("#btn-play").click();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 2 of 3");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 3 of 3");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 3 of 3");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#status")).toContainText("Slide 2 of 3");
    await page.keyboard.press("Escape");
    await expect(page.locator("folio-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("slide CSS applies only with the flag: aspect and scale", async ({
    page,
  }) => {
    await loadDeck(page);
    const before = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const h1 = root?.querySelector("article.folio-doc > h1");
      return h1 ? getComputedStyle(h1 as HTMLElement).aspectRatio : "";
    });
    expect(before).toBe("auto");
    await page.locator("#btn-play").click();
    const during = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const h1 = root?.querySelector("article.folio-doc > h1");
      return h1 ? getComputedStyle(h1 as HTMLElement).aspectRatio : "";
    });
    expect(during).toBe("16 / 9");
  });

  test("print media while playing uses 16:9 pages and breaks H1s", async ({
    page,
  }) => {
    await loadDeck(page);
    await page.locator("#btn-play").click();
    await page.emulateMedia({ media: "print" });
    const size = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--folio-page-size",
      ),
    );
    // beforeprint sets the page size from the session (16:9 while playing).
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const sizeAfter = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--folio-page-size",
      ),
    );
    expect(sizeAfter.trim()).toBe("16in 9in");
    expect(size).not.toBe("16in 9in");
    const css = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      return root?.querySelector("style")?.textContent ?? "";
    });
    expect(css).toContain("article.folio-doc[slides] > h1:not(:first-child)");
    await page.emulateMedia({ media: "screen" });
  });

  test("print with play off stays A4", async ({ page }) => {
    await loadDeck(page);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const size = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--folio-page-size",
      ),
    );
    expect(size.trim()).toBe("A4");
  });

  test("page furniture is suppressed while playing", async ({ page }) => {
    await loadDeck(page);
    await page.locator("#btn-play").click();
    const css = await page.evaluate(
      () => document.querySelector("#print-furniture")?.textContent ?? "",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const cssAfter = await page.evaluate(
      () => document.querySelector("#print-furniture")?.textContent ?? "",
    );
    expect(css).not.toBe(cssAfter);
    expect(cssAfter).not.toContain("@top-left");
    expect(cssAfter).not.toContain("counter(page)");
  });

  test("the document model is unchanged by playing", async ({ page }) => {
    await loadDeck(page);
    const before = await page.evaluate(
      () =>
        document.querySelector("folio-doc")?.getAttribute("src") ??
        (
          document.querySelector("folio-doc") as unknown as {
            getMarkdown(): string;
          }
        ).getMarkdown(),
    );
    await page.locator("#btn-play").click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    const after = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getMarkdown(): string;
        }
      ).getMarkdown(),
    );
    expect(after).toBe(before);
  });

  test("switching to Markdown view stops the slideshow", async ({ page }) => {
    await loadDeck(page);
    await page.locator("#btn-play").click();
    await expect(page.locator("folio-doc")).toHaveAttribute("slides", /.*/);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("folio-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("TOC lists every H1 while playing, lone-H1 rule off otherwise", async ({
    page,
  }) => {
    await loadDeck(page);
    // The deck has 3 H1s, so both modes list them; use a lone-H1 doc
    // to see the difference.
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill("# Only\n\n[[_TOC_]]\n\nText.\n");
    await page.locator("#btn-view").click();
    await expect(page.locator("folio-doc nav.folio-toc")).toContainText(
      "Headings will be listed here",
    );
    await page.locator("#btn-play").click();
    await expect(page.locator("folio-doc nav.folio-toc")).toContainText("Only");
  });

  test("settings dialog writes page.size through the YAML pipeline", async ({
    page,
  }) => {
    await loadDeck(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-page-size").selectOption("16:9");
    await page.locator("#settings-form button[type=submit]").click();
    await expect(page.locator("#btn-settings")).toBeVisible();
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toContainText("page.size: 16:9");
  });

  test("deck themes appear in the theme picker", async ({ page }) => {
    await loadDeck(page);
    await page.locator("#btn-settings").click();
    await expect(
      page.locator(".theme-card", { hasText: "Deck (dark)" }),
    ).toBeVisible();
    await expect(
      page.locator(".theme-card", { hasText: "Deck (light)" }),
    ).toBeVisible();
    await page.locator("#btn-settings-cancel").click();
  });
});
