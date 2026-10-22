import { expect, test, type Page } from "@playwright/test";
import { insertFrom, pickStyle } from "./toolbar-helpers";

/** The toolbar (spec: docs/specs/toolbar.md). */

async function open(page: Page, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/?doc=demo/examples/sales-review.md");
  await page.locator("folio-doc h1").first().waitFor();
}

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await open(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

test.describe("toolbar", () => {
  for (const width of [1280, 1000, 800, 390]) {
    test(`one row that fits at ${String(width)}px; More tools has the rest`, async ({
      page,
    }) => {
      await open(page, width);
      const fit = await page.locator("header .toolbar").evaluate((t) => ({
        sw: t.scrollWidth,
        cw: t.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      expect(fit.sw).toBeLessThanOrEqual(fit.cw);
      expect(fit.page).toBeLessThanOrEqual(width);
      // Every control is in the bar or in More tools - never lost.
      for (const id of [
        "#btn-new",
        "#btn-undo",
        "#btn-style-menu",
        "#fmt-bar",
        "#btn-insert-menu",
        "#view-switch",
        "#btn-search",
        "#btn-settings",
        "#btn-mode",
        "#btn-help",
      ]) {
        const node = page.locator(id);
        const inMenu = await node.evaluate(
          (n) => n.closest("#overflow-menu") !== null,
        );
        if (!inMenu) await expect(node).toBeInViewport();
      }
      if (width === 1280) {
        await expect(page.locator("#overflow-wrap")).toBeHidden();
      } else {
        await page.locator("#btn-overflow").click();
        const menu = page.locator("#overflow-menu");
        await expect(menu).toBeVisible();
        await expect(menu.locator("#btn-mode")).toBeInViewport();
        // The menu sits on screen, not clipped by the bar.
        const box = await menu.boundingBox();
        expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      }
    });
  }

  test("groups come back from More tools when the window widens", async ({
    page,
  }) => {
    await open(page, 800);
    await expect(page.locator("#overflow-menu #btn-mode")).toHaveCount(1);
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(page.locator("#overflow-wrap")).toBeHidden();
    await expect(page.locator("header .toolbar > #btn-mode")).toBeVisible();
  });

  test("the style menu names the caret's style and sets it", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n## Part\n\nSome text.\n");
    await page.locator("#the-doc h2").click();
    await expect(page.locator("#style-label")).toHaveText("Heading 2");
    await page.locator("#the-doc p").click();
    await expect(page.locator("#style-label")).toHaveText("Paragraph");
    await pickStyle(page, "h3");
    await expect(page.locator("#the-doc h3")).toHaveText("Some text.");
    await expect(page.locator("#style-label")).toHaveText("Heading 3");
    await expect(page.locator("#style-menu")).toBeHidden();
  });

  test("Insert places a palette-only insert at the caret", async ({ page }) => {
    await loadDoc(page, "# T\n\nFirst.\n\nSecond.\n");
    await page.locator("#the-doc p", { hasText: "First." }).click();
    await page.locator("#btn-insert-menu").click();
    await page
      .locator('#insert-menu [data-insert="Insert a Graphviz diagram (DOT)"]')
      .click();
    await expect(page.locator("#insert-menu")).toBeHidden();
    await expect(
      page.locator("#the-doc p:has-text('First.') + figure.folio-dot"),
    ).toHaveCount(1);
  });

  test("a click on dark mode keeps the caret in the document", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nAbc\n");
    await page.locator("#the-doc p").click();
    await page.keyboard.press("End");
    await page.locator("#btn-mode").click();
    await page.keyboard.type("def");
    await expect(page.locator("#the-doc p")).toHaveText("Abcdef");
  });

  test("the window title names the document", async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle("Q3 Sales Review — folio");
    await page.locator("#the-doc h1").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" draft");
    await expect(page).toHaveTitle("Q3 Sales Review draft — folio");
  });

  test("while recording, the bar says so and stops it", async ({ page }) => {
    await page.context().grantPermissions(["microphone"]);
    await loadDoc(page, "# T\n\nText.\n");
    await page.locator("#the-doc p").click();
    await insertFrom(page, "btn-record");
    const stop = page.locator("#btn-rec-stop");
    await expect(stop).toBeVisible();
    await stop.click();
    await expect(stop).toBeHidden();
  });
});

test.describe("toolbar: first-contact eval fixes", () => {
  test("every control in the bar is the same height", async ({ page }) => {
    await open(page);
    const heights = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".toolbar > *, header > button"))
        .filter((n) => (n as HTMLElement).offsetParent !== null)
        .filter((n) => !n.classList.contains("toolbar-spacer"))
        .map((n) => Math.round(n.getBoundingClientRect().height)),
    );
    expect(new Set(heights)).toEqual(new Set([36]));
  });

  test("recording on a phone still fits, and Search comes back", async ({
    page,
  }) => {
    await page.context().grantPermissions(["microphone"]);
    await open(page, 390);
    await page.locator("#the-doc p").first().click();
    await insertFrom(page, "btn-record");
    await expect(page.locator("#btn-rec-stop")).toBeInViewport();
    await expect(page.locator("#btn-overflow")).toBeInViewport();
    const fit = await page
      .locator("header .toolbar")
      .evaluate((t) => t.scrollWidth <= t.clientWidth);
    expect(fit).toBe(true);
    await page.locator("#btn-rec-stop").click();
    await expect(page.locator("header .toolbar > #btn-search")).toBeVisible();
  });

  test("More tools labels its groups", async ({ page }) => {
    await open(page, 800);
    await page.locator("#btn-overflow").click();
    await expect(
      page.locator("#overflow-menu .overflow-row", { hasText: "Format" }),
    ).toContainText("Format");
  });

  test("a new equation opens its editor; typing replaces the placeholder", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nText.\n");
    await page.locator("#the-doc p").click();
    await insertFrom(page, "btn-equation");
    await page.keyboard.type("a^2 + b^2");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "$$\na^2 + b^2\n$$",
    );
  });

  test("after a chart, typing carries on below it", async ({ page }) => {
    await loadDoc(
      page,
      "# T\n\n::: table {#t}\ncolumns:\n  - {name: k, type: text}\n  - {name: v, type: number}\ndata:\n  - [a, 1]\n:::\n\nFirst.\n\nSecond.\n",
    );
    await page.locator("#the-doc p", { hasText: "First." }).click();
    await page.locator("#btn-insert-menu").click();
    await page.locator('#insert-menu [data-insert="Insert a chart"]').click();
    await page.keyboard.type("Then ");
    await expect(
      page.locator("#the-doc p", { hasText: "Then Second." }),
    ).toHaveCount(1);
  });

  test("an empty paragraph is a blank line, not a literal mark", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nText.\n");
    await page.locator("#the-doc p").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const mark = await page
      .locator("#the-doc p")
      .last()
      .evaluate((p) => getComputedStyle(p, "::before").content);
    expect(["none", "normal"]).toContain(mark);
  });
});
