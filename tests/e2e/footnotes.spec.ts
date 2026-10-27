import { expect, test, type Page } from "@playwright/test";

/** Footnotes (spec: docs/specs/footnotes.md). */

const DOC = `# Field notes

Revenue grew[^growth], led by the North[^north]. Again the first[^growth].

[^growth]: Compared with Q2.
[^north]: Two new managers.
[^spare]: Nothing refers to this one.
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

const source = async (page: Page): Promise<string> => {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  return page.locator("#editor").inputValue();
};

test.describe("footnotes", () => {
  test("references are numbered in reading order; notes gather at the end", async ({
    page,
  }) => {
    await load(page, DOC);
    await expect(page.locator("#the-doc sup.folio-fnref")).toHaveText([
      "1",
      "2",
      "1",
    ]);
    const notes = page.locator("#the-doc section.folio-notes li .fn-text");
    await expect(notes).toHaveText([
      "Compared with Q2.",
      "Two new managers.",
      "Nothing refers to this one.",
    ]);
    // The definitions themselves are not shown where they were written.
    await expect(page.locator("#the-doc aside.folio-fndefs")).toBeHidden();
  });

  test("a note edits in place and writes back to its definition", async ({
    page,
  }) => {
    await load(page, DOC);
    await page
      .locator("#the-doc section.folio-notes li .fn-text")
      .first()
      .click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Constant currency.");
    await page.keyboard.press("Home");
    await page.keyboard.type("Note: ");
    await page.keyboard.press("Enter"); // a note is one paragraph
    expect(await source(page)).toContain(
      "[^growth]: Note: Compared with Q2. Constant currency.\n[^north]: Two new managers.",
    );
  });

  test("Insert › Footnote adds a reference and an empty note to type into", async ({
    page,
  }) => {
    await load(page, "# T\n\nThe claim.\n");
    await page.locator("#the-doc p").click();
    await page.keyboard.press("End");
    await page.locator("#btn-insert-menu").click();
    await page
      .locator('#insert-menu [data-insert="Insert a footnote"]')
      .click();
    await page.keyboard.type("Source: the survey.");
    expect(await source(page)).toBe(
      "# T\n\nThe claim.[^1]\n\n[^1]: Source: the survey.\n",
    );
  });

  test("the palette finds it, and says where to put the cursor", async ({
    page,
  }) => {
    await load(page, "# T\n\nText.\n");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("footnote");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Insert a footnote");
    await page.keyboard.press("Enter");
    await expect(page.locator("#status")).toContainText("Put the cursor");
  });

  test("a reference jumps to its note, and ↩ comes back", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    const filler = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${String(i)}.`,
    ).join("\n\n");
    await load(page, `# T\n\nA claim[^a].\n\n${filler}\n\n[^a]: The note.\n`);
    const note = page.locator("#the-doc section.folio-notes li").first();
    await expect(note).not.toBeInViewport();
    await page.locator("#the-doc sup.folio-fnref").click();
    await expect(note).toBeInViewport();
    await note.locator(".fn-back").click();
    await expect(page.locator("#the-doc sup.folio-fnref")).toBeInViewport();
  });

  test("a number takes the cursor to its note; ↩ brings it back after the number", async ({
    page,
  }) => {
    await load(page, "# T\n\nA claim[^a] and more.\n\n[^a]: The note.\n");
    await page.locator("#the-doc sup.folio-fnref").click();
    const li = page.locator("#the-doc section.folio-notes li").first();
    await expect(li).toHaveClass(/folio-fn-target/);
    await page.keyboard.type(" Typed in the note.");
    await li.locator(".fn-back").click();
    await page.keyboard.type(" (see note)");
    const md = await source(page);
    expect(md).toContain("A claim[^a] (see note) and more.");
    expect(md).toContain("[^a]: The note. Typed in the note.");
  });

  test("a space typed before an inserted footnote stays an ordinary space", async ({
    page,
  }) => {
    await load(page, "# T\n\nThe claim\n");
    await page.locator("#the-doc p").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" ");
    await page.locator("#btn-insert-menu").click();
    await page
      .locator('#insert-menu [data-insert="Insert a footnote"]')
      .click();
    await page.keyboard.type("Note.");
    expect(await source(page)).toContain("The claim [^1]\n");
  });
});
