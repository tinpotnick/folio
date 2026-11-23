import { expect, test, type Page } from "@playwright/test";

/**
 * Print / PDF: one pipeline - the OS print dialog (which exports
 * PDF everywhere) over a print stylesheet that shows the document,
 * not the app chrome.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

test.describe("print and PDF", () => {
  test("print media hides the app chrome and shows the document", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("header")).toBeHidden();
    await expect(page.locator("#sidebar")).toBeHidden();
    await expect(page.locator("#status")).toBeHidden();
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await expect(page.locator("header")).toBeVisible();
  });

  test("printing from the Markdown view switches to the document first", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(page.locator("#editor")).toBeHidden();
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
  });

  test("an open help panel does not print", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await expect(page.locator("#help-panel")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#help-panel")).toBeHidden();
    await expect(page.locator("#the-doc")).toBeVisible();
  });

  test("the palette print command calls window.print", async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => {
        (window as unknown as { __printed: number }).__printed =
          ((window as unknown as { __printed?: number }).__printed ?? 0) + 1;
      };
    });
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("print");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Print the document");
    await page.keyboard.press("Enter");
    const printed = await page.evaluate(
      () => (window as unknown as { __printed?: number }).__printed,
    );
    expect(printed).toBe(1);
  });

  test("the H2 page-break setting applies in print media", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-pb-h2").selectOption("before");
    await page.locator("#settings-form button[type=submit]").click();
    await page.emulateMedia({ media: "print" });
    const breakBefore = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const h2 = root?.querySelector("h2");
      return h2 ? getComputedStyle(h2).breakBefore : null;
    });
    expect(breakBefore).toBe("page");
    await page.emulateMedia({ media: "screen" });
    const screenBreak = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const h2 = root?.querySelector("h2");
      return h2 ? getComputedStyle(h2).breakBefore : null;
    });
    expect(screenBreak).not.toBe("page");
  });

  test("pages carry the title and their numbers (docs/specs/print.md)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const css = await page.locator("style#print-furniture").textContent();
    expect(css).toContain('@top-left { content: "Q3 Field Operations Review"');
    expect(css).toContain('"Page " counter(page) " of " counter(pages)');
    expect(css).toContain("@page :first { @top-left { content: none; } }");
  });

  test("page numbers and the header turn off in Document settings", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("page numbers");
    await page.keyboard.press("Enter");
    await expect(page.locator("#settings-modal")).toBeVisible();
    await expect(page.locator("#set-page-numbers")).toBeFocused();
    await page.locator("#set-page-numbers").selectOption("off");
    await page.locator("#set-page-header").selectOption("off");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toMatch(/page\.numbers: "?off"?/);
    expect(md).toMatch(/page\.header: "?off"?/);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    expect(await page.locator("style#print-furniture").textContent()).toBe("");
  });

  test("dark mode prints on light paper, then comes back", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-mode").click();
    const docMode = (): Promise<string | null> =>
      page.locator("#the-doc").getAttribute("mode");
    await expect.poll(docMode).toBe("dark");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect.poll(docMode).toBe("light");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect.poll(docMode).toBe("dark");
  });

  test("a long table prints its row count, not its Open dataset button", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/repay-or-invest.md");
    const more = page
      .locator('#the-doc figure[data-table-id="plan"] .folio-table-more')
      .first();
    await expect(more.locator(".ds-open")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(more.locator(".ds-open")).toBeHidden();
    await expect(more).toContainText(/[\d,]+ rows/);
  });
});

test.describe("page sections (docs/specs/print.md, 'Page sections')", () => {
  const MD =
    '# Report\n\nIntro.\n\n::: page {#sec-1}\nheader: "Part One"\nfooter: "Draft"\n:::\n\nBody one.\n\n::: page {#sec-2}\nnumbers: off\norientation: landscape\n:::\n\nBody two.\n';

  async function loadMd(page: Page, md: string): Promise<void> {
    await page.goto("/?doc=demo/examples/poem.md");
    await page.locator("#the-doc h1").first().waitFor();
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    await page.locator("#editor").fill(md);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    await page.locator("#the-doc h1").first().waitFor();
  }

  test("a ::: page block is invisible on screen, section-tagged, and forces a page break in print", async ({
    page,
  }) => {
    await loadMd(page, MD);
    const mark = page.locator("#the-doc .folio-pagemark").first();
    await expect(mark).toHaveCount(1);
    await expect(mark).toBeHidden(); // page-only: never screen content
    // Section classes: the marker and the blocks after it are section 2.
    await expect(
      page.locator('#the-doc [data-block-index="3"].folio-sec-1'),
    ).toHaveCount(1);
    await expect(
      page.locator('#the-doc [data-block-index="5"].folio-sec-2'),
    ).toHaveCount(1);
    // Print media: the marker becomes a zero-height forced break.
    await page.emulateMedia({ media: "print" });
    const inPrint = await mark.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { display: cs.display, breakBefore: cs.breakBefore };
    });
    expect(inPrint.display).toBe("block");
    expect(inPrint.breakBefore).toBe("page");
    // The shadow print style names the section's pages.
    const printCss = await page.evaluate(
      () =>
        document
          .querySelector("#the-doc")
          ?.shadowRoot?.querySelector("#folio-print-sections")?.textContent ??
        "",
    );
    expect(printCss).toContain(".folio-sec-1 { page: folio-sec-1; }");
    expect(printCss).toContain(".folio-sec-2 { page: folio-sec-2; }");
    await page.emulateMedia({ media: "screen" });
    await expect(mark).toBeHidden();
  });

  test("beforeprint writes one named @page per section with carried-forward size", async ({
    page,
  }) => {
    await loadMd(page, MD);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const css = await page.locator("style#print-furniture").textContent();
    // Base page: section 0 (title header + numbers).
    expect(css).toContain('@page { @top-left { content: "Report";');
    expect(css).toContain("@page :first { @top-left { content: none; } }");
    // Section 1: its own header/footer, numbers carried forward, size restated.
    expect(css).toContain(
      '@page folio-sec-1 { size: A4; @top-left { content: "Part One";',
    );
    expect(css).toContain('@bottom-left { content: "Draft";');
    // Section 2: landscape, numbers off (no bottom-right box in its rule).
    expect(css).toContain(
      '@page folio-sec-2 { size: A4 landscape; @top-left { content: "Part One";',
    );
    const sec2 = (css ?? "").slice((css ?? "").indexOf("@page folio-sec-2"));
    expect(sec2).not.toContain("@bottom-right");
  });

  test("the palette's Insert page section writes a ::: page block to the source", async ({
    page,
  }) => {
    await loadMd(page, "# T\n\nSome text.\n");
    await page.locator("#the-doc p", { hasText: "Some text" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert page section");
    await page.keyboard.press("Enter");
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: page {#sec-1}");
    expect(md).toContain(":::");
  });

  test("orientation is a Document settings dropdown and lands in the base page size", async ({
    page,
  }) => {
    await loadMd(page, "# T\n\nText.\n");
    await page.locator("#btn-settings").click();
    await expect(page.locator("#settings-modal")).toBeVisible();
    await page.locator("#set-page-orientation").selectOption("landscape");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toMatch(/page\.orientation: "?landscape"?/);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    await page.locator("#the-doc h1").first().waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    expect(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--folio-page-size"),
      ),
    ).toBe("A4 landscape");
  });
});
