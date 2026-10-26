import { expect, test, type Page } from "@playwright/test";

/** Table of contents (docs/specs/contents.md). */

const DOC = `# Report

Intro.

## First

Text.

### Detail

Text.

## Second

Text.
`;

async function load(page: Page, md: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
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

test.describe("table of contents", () => {
  test("Insert › Table of contents lists the sections, nested, without the title", async ({
    page,
  }) => {
    await load(page, DOC);
    await page.locator("#the-doc p", { hasText: "Intro." }).click();
    await page.locator("#btn-insert-menu").click();
    await page
      .locator('#insert-menu [data-insert="Insert a table of contents"]')
      .click();
    const toc = page.locator("#the-doc nav.folio-toc");
    await expect(toc.locator("a.folio-toc-link")).toHaveText([
      "First",
      "Detail",
      "Second",
    ]);
    await expect(toc.locator("ol ol a")).toHaveText(["Detail"]);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-markdown")?.click(),
    );
    expect(await page.locator("#editor").inputValue()).toContain(
      "Intro.\n\n[[_TOC_]]\n\n## First",
    );
  });

  test("an entry jumps to its section; the list follows new and renamed headings", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    const filler = Array.from(
      { length: 25 },
      (_, i) => `Para ${String(i)}.`,
    ).join("\n\n");
    await load(
      page,
      DOC.replace("## Second", `${filler}\n\n## Second`).replace(
        "Intro.",
        "Intro.\n\n[[_TOC_]]",
      ),
    );
    const second = page.locator("#the-doc h2", { hasText: "Second" });
    await expect(second).not.toBeInViewport();
    await page
      .locator("#the-doc nav.folio-toc a", { hasText: "Second" })
      .click();
    await expect(second).toBeInViewport();
    // Rename it by typing.
    await second.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" thoughts");
    await expect(page.locator("#the-doc nav.folio-toc a").last()).toHaveText(
      "Second thoughts",
    );
  });
});
