import { expect, test, type Page } from "@playwright/test";

/**
 * Slideshow (docs/specs/slides.md): play toggles a slide-rendering
 * flag on the document view (the H1 is the deck title, one slide per
 * H2, full DOM) plus fullscreen. The file is never changed by
 * presenting.
 */

const DECK = [
  "# The deck title",
  "",
  "Preamble instructions under the H1 - front matter, never a slide.",
  "",
  "## Alpha",
  "",
  "- one",
  "- two",
  "",
  "## Beta",
  "",
  "Just a sentence.",
  "",
  "> A speaker note for this slide.",
  "",
  "## Gamma",
  "",
  "![pic](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)",
  "",
].join("\n");

async function loadDeck(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("#the-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(DECK);
  await page.locator("#btn-view").click();
  await expect(page.locator("#the-doc h2", { hasText: "Alpha" })).toBeVisible();
}

/** Toggle play via the play button's dropdown (Export-style menu). */
async function togglePlay(page: Page): Promise<void> {
  await page.locator("#btn-play").click();
  await page.locator("#mi-play").click();
}

async function slideHeads(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("#the-doc")?.shadowRoot;
    return Array.from(
      root?.querySelectorAll("article.folio-doc .folio-slide > h2") ?? [],
    ).map((h) => (h as HTMLElement).textContent);
  });
}

async function h1Visible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.querySelector("#the-doc")?.shadowRoot;
    const h1 = root?.querySelector("article.folio-doc > h1");
    return h1 ? getComputedStyle(h1 as HTMLElement).display !== "none" : false;
  });
}

test.describe("slideshow", () => {
  test("play toggles slide rendering on the document view", async ({
    page,
  }) => {
    await loadDeck(page);
    await expect(page.locator("#the-doc")).not.toHaveAttribute("slides", /.*/);
    await togglePlay(page);
    await expect(page.locator("#the-doc")).toHaveAttribute("slides", /.*/);
    // While presenting, the play control is the active one - not the
    // document icon.
    await expect(page.locator("#btn-play")).toHaveClass(/active/);
    await expect(page.locator("#btn-view")).not.toHaveClass(/active/);
    // Full DOM, no windowing: every slide is in the article at once.
    expect(await slideHeads(page)).toEqual(["Alpha", "Beta", "Gamma"]);
    // H1 is the deck title: hidden while playing, present in the DOM.
    expect(await h1Visible(page)).toBe(false);
    await togglePlay(page);
    await expect(page.locator("#the-doc")).not.toHaveAttribute("slides", /.*/);
    await expect(page.locator("#btn-play")).not.toHaveClass(/active/);
    await expect(page.locator("#btn-view")).toHaveClass(/active/);
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
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("presenter");
    await expect(
      page.locator("#palette-modal .palette-item", {
        hasText: "Open presenter view",
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("play");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc")).toHaveAttribute("slides", /.*/);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("stop");
    await expect(
      page.locator("#palette-modal .palette-item", {
        hasText: "Stop slideshow",
      }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("one slide per H2; counter reads n of N", async ({ page }) => {
    await loadDeck(page);
    await togglePlay(page);
    await expect(page.locator("#status")).toContainText("Slide 1 of 3");
    const heads = await slideHeads(page);
    expect(heads).toHaveLength(3);
    // The H1 is the title, not a slide; the preamble is not a slide.
    await expect(page.locator("#the-doc h1")).toHaveCount(1);
  });

  test("arrow keys advance and clamp at the last slide; Esc stops", async ({
    page,
  }) => {
    await loadDeck(page);
    await togglePlay(page);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 2 of 3");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 3 of 3");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 3 of 3");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#status")).toContainText("Slide 2 of 3");
    await page.keyboard.press("Escape");
    await expect(page.locator("#the-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("slide CSS applies only with the flag: aspect and scale", async ({
    page,
  }) => {
    await loadDeck(page);
    // Document view: no slide wrappers, no flag - the article's
    // children are exactly the blocks.
    const before = await page.evaluate(() => {
      const root = document.querySelector("#the-doc")?.shadowRoot;
      const art = root?.querySelector("article.folio-doc");
      return {
        wrappers: art?.querySelectorAll(":scope > .folio-slide").length ?? -1,
        attr: art?.hasAttribute("slides") ?? true,
      };
    });
    expect(before.wrappers).toBe(0);
    expect(before.attr).toBe(false);
    await togglePlay(page);
    const during = await page.evaluate(() => {
      const root = document.querySelector("#the-doc")?.shadowRoot;
      const slide = root?.querySelector("article.folio-doc .folio-slide");
      return slide ? getComputedStyle(slide as HTMLElement).aspectRatio : "";
    });
    expect(during).toBe("16 / 9");
  });

  test("print media while playing uses 16:9 pages, one slide per page", async ({
    page,
  }) => {
    await loadDeck(page);
    await togglePlay(page);
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
      const root = document.querySelector("#the-doc")?.shadowRoot;
      return root?.querySelector("style")?.textContent ?? "";
    });
    expect(css).toContain("article.folio-doc[slides] .folio-slide");
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
    // Play off: beforeprint stamps the running header and page numbers.
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const off = await page.evaluate(
      () => document.querySelector("#print-furniture")?.textContent ?? "",
    );
    expect(off).toContain("@top-left");
    expect(off).toContain("counter(page)");
    // Playing: one slide per page needs no furniture.
    await togglePlay(page);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const on = await page.evaluate(
      () => document.querySelector("#print-furniture")?.textContent ?? "",
    );
    expect(on).not.toContain("@top-left");
    expect(on).not.toContain("counter(page)");
  });

  test("the document model is unchanged by playing", async ({ page }) => {
    await loadDeck(page);
    const before = await page.evaluate(
      () =>
        document.querySelector("#the-doc")?.getAttribute("src") ??
        (
          document.querySelector("#the-doc") as unknown as {
            getMarkdown(): string;
          }
        ).getMarkdown(),
    );
    await togglePlay(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    const after = await page.evaluate(() =>
      (
        document.querySelector("#the-doc") as unknown as {
          getMarkdown(): string;
        }
      ).getMarkdown(),
    );
    expect(after).toBe(before);
  });

  test("switching to Markdown view stops the slideshow", async ({ page }) => {
    await loadDeck(page);
    await togglePlay(page);
    await expect(page.locator("#the-doc")).toHaveAttribute("slides", /.*/);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#the-doc")).not.toHaveAttribute("slides", /.*/);
  });

  test("clicking document view while presenting stops the show", async ({
    page,
  }) => {
    await loadDeck(page);
    await togglePlay(page);
    await expect(page.locator("#btn-play")).toHaveClass(/active/);
    await page.locator("#btn-view").click();
    await expect(page.locator("#the-doc")).not.toHaveAttribute("slides", /.*/);
    await expect(page.locator("#btn-play")).not.toHaveClass(/active/);
    await expect(page.locator("#btn-view")).toHaveClass(/active/);
  });

  test("TOC lists the H2 slides; a lone H1 stays the title in both views", async ({
    page,
  }) => {
    await loadDeck(page);
    // The deck has 3 H1s, so both modes list them; use a lone-H1 doc
    // to see the difference.
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill("# Only\n\n[[_TOC_]]\n\nText.\n\n## A slide\n\nBody.\n");
    await page.locator("#btn-view").click();
    // A lone H1 is the title in BOTH views now (H2s are the slides).
    await expect(page.locator("#the-doc nav.folio-toc")).toContainText(
      "A slide",
    );
    await expect(page.locator("#the-doc nav.folio-toc")).not.toContainText(
      "Only",
    );
  });

  test("settings dialog writes page.size through the YAML pipeline", async ({
    page,
  }) => {
    await loadDeck(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-page-size").selectOption("16:9");
    await page.locator("#settings-form button[type=submit]").click();
    await expect(page.locator("#status")).toContainText("Settings applied");
    // The serializer quotes the value (it contains a colon); the
    // document's Markdown carries the key through the YAML pipeline.
    const md = await page.evaluate(() =>
      (
        document.querySelector("#the-doc") as unknown as {
          getMarkdown(): string;
        }
      ).getMarkdown(),
    );
    expect(md).toContain('page.size: "16:9"');
    // And it round-trips back out of the Markdown view.
    await page.locator("#btn-markdown").click();
    await page.locator("#btn-view").click();
    const md2 = await page.evaluate(() =>
      (
        document.querySelector("#the-doc") as unknown as {
          getMarkdown(): string;
        }
      ).getMarkdown(),
    );
    expect(md2).toContain('page.size: "16:9"');
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

test.describe("slideshow v2: H2 slides, notes, example deck", () => {
  test("speaker notes stay off the main display; N shows them; never print", async ({
    page,
  }) => {
    await loadDeck(page);
    await togglePlay(page);
    const note = page.locator("#the-doc .folio-slide > blockquote:last-child");
    await expect(note).toHaveCount(1);
    // The PowerPoint presenter rule: the main display never shows notes.
    await expect(note).toBeHidden();
    // N toggles them on for the presenter...
    await page.keyboard.press("n");
    await expect(note).toBeVisible();
    expect(
      await page.evaluate(() =>
        document.querySelector("#the-doc")?.classList.contains("slides-notes"),
      ),
    ).toBe(true);
    // ...and the palette offers the same action...
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("notes");
    await expect(
      page.locator("#palette-modal .palette-item", {
        hasText: "Toggle speaker notes",
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    // ...and N again hides them.
    await page.keyboard.press("n");
    await expect(note).toBeHidden();
    // Notes are display:none in print media, with or without the toggle.
    await page.keyboard.press("n");
    await page.emulateMedia({ media: "print" });
    const printDisplay = await page.evaluate(() => {
      const root = document.querySelector("#the-doc")?.shadowRoot;
      const q = root?.querySelector(".folio-slide > blockquote:last-child");
      return q ? getComputedStyle(q as HTMLElement).display : "";
    });
    expect(printDisplay).toBe("none");
    await page.emulateMedia({ media: "screen" });
  });

  test("editing inside a slide keeps the model intact (wrappers are transparent)", async ({
    page,
  }) => {
    await loadDeck(page);
    await togglePlay(page);
    const before = await page.evaluate(() =>
      (
        document.querySelector("#the-doc") as unknown as {
          getMarkdown(): string;
        }
      ).getMarkdown(),
    );
    await page
      .locator("folio-doc .folio-slide p", { hasText: "Just a sentence." })
      .click();
    await page.keyboard.type(" More.");
    const after = await page.evaluate(() =>
      (
        document.querySelector("#the-doc") as unknown as {
          getMarkdown(): string;
        }
      ).getMarkdown(),
    );
    expect(after).toBe(
      before.replace("Just a sentence.", "Just a sentence. More."),
    );
    // The slide wrappers survive the sync (still 3 slides).
    expect(await slideHeads(page)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  test("presenter view: a second window shows the notes and syncs both ways", async ({
    page,
  }) => {
    await loadDeck(page);
    await togglePlay(page);
    // The presenter view is the play button's dropdown (chevron),
    // which offers the two presentation options.
    await page.locator("#btn-play").click();
    await expect(page.locator("#mi-play")).toBeVisible();
    await expect(page.locator("#mi-presenter")).toBeVisible();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.locator("#mi-presenter").click(),
    ]);
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator("#presenter-bar")).toContainText("Slide 1 of 3");
    await expect(popup.locator("#presenter-bar")).toContainText("now: Alpha");
    // Notes on the presenter window, never on the main display.
    await expect(
      popup.locator("#the-doc .folio-slide blockquote"),
    ).toBeVisible();
    await expect(
      page.locator("#the-doc .folio-slide > blockquote:last-child"),
    ).toBeHidden();
    // Main window drives -> presenter follows.
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 2 of 3");
    await expect(popup.locator("#presenter-bar")).toContainText("Slide 2 of 3");
    // Presenter window drives -> main follows.
    await popup.keyboard.press("ArrowRight");
    await expect(popup.locator("#presenter-bar")).toContainText("Slide 3 of 3");
    await expect(page.locator("#status")).toContainText("Slide 3 of 3");
  });

  test("the shipped deck example plays: H2 slides, chart on a slide", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/deck.md");
    await expect(
      page.locator("#the-doc h1", { hasText: "Quarterly Review Deck" }),
    ).toBeVisible();
    // The deck THEME defaults its paper to the slide aspect: printing
    // without playing already yields 16:9 pages.
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const size = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--folio-page-size",
      ),
    );
    expect(size.trim()).toBe("16in 9in");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await togglePlay(page);
    expect(await slideHeads(page)).toEqual([
      "Revenue by region",
      "Regional detail",
      "Growth chart",
      "Closing",
    ]);
    await expect(page.locator("#status")).toContainText("Slide 1 of 4");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toContainText("Slide 3 of 4");
    await expect(page.locator("#the-doc [data-chart-source]")).toBeVisible();
    // Preamble hidden while playing.
    expect(await h1Visible(page)).toBe(false);
  });
});
