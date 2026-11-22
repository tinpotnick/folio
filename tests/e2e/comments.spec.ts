import { expect, test, type Page } from "@playwright/test";

/** Comments (spec: docs/specs/comments.md). */

const DOC = `# Reviewed draft

Growth was strongest in the Midlands at 17.9%.

::: comment {#c-1}
anchor: reviewed-draft
quote: "Growth was strongest"
author: nick
created: 2026-11-20
Growth was strongest - pre- or post- pricing?
:::

::: comment {#c-2}
author: sam
created: 2026-11-21
resolved: true
Document-level note.
:::
`;

async function load(page: Page, md: string, author = "nick"): Promise<void> {
  await page.addInitScript((a) => {
    localStorage.setItem("folio.guided", "1");
    if (a) localStorage.setItem("folio-comment-author", a);
  }, author);
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

const view = async (page: Page): Promise<void> => {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-view")?.click(),
  );
  await page.locator("#the-doc h1").first().waitFor();
};

test.describe("comments", () => {
  test("comment blocks render as asides; the quote is highlighted; source round-trips", async ({
    page,
  }) => {
    await load(page, DOC);
    const asides = page.locator("#the-doc aside.folio-comment");
    await expect(asides).toHaveCount(2);
    await expect(asides.first().locator(".folio-comment-author")).toHaveText(
      "nick",
    );
    await expect(asides.first().locator(".folio-comment-quote")).toHaveText(
      "Growth was strongest",
    );
    await expect(asides.first().locator(".folio-comment-body")).toHaveText(
      "Growth was strongest - pre- or post- pricing?",
    );
    await expect(asides.nth(1)).toHaveClass(/resolved/);
    // The quoted text is marked inside the anchored section.
    await expect(
      page.locator("#the-doc mark.folio-comment-mark[data-comment-id='c-1']"),
    ).toHaveText("Growth was strongest");
    // The block round-trips in the Markdown view.
    const md = await source(page);
    expect(md).toContain("::: comment {#c-1}");
    expect(md).toContain("anchor: @reviewed-draft");
    expect(md).toContain("resolved: true");
  });

  test("Add a comment from the palette quotes the selection and writes a ::: comment block", async ({
    page,
  }) => {
    await load(
      page,
      "# Reviewed draft\n\nGrowth was strongest in the Midlands.\n",
    );
    // Select the sentence: click into the paragraph, Home, Shift+End.
    const p = page.locator("#the-doc p", { hasText: "Growth was strongest" });
    await p.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("add a comment");
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-modal")).toBeHidden();
    // The caret is in the new comment's body: type the comment.
    await page.keyboard.type("Check the pricing change.");
    const asides = page.locator("#the-doc aside.folio-comment");
    await expect(asides).toHaveCount(1);
    await expect(asides.locator(".folio-comment-body")).toHaveText(
      "Check the pricing change.",
    );
    await expect(
      page.locator("#the-doc mark.folio-comment-mark[data-comment-id='c-1']"),
    ).toHaveText("Growth was strongest in the Midlands.");
    const md = await source(page);
    expect(md).toContain("::: comment {#c-1}");
    expect(md).toContain('quote: "Growth was strongest in the Midlands."');
    expect(md).toContain("author: nick");
    expect(md).toContain("Check the pricing change.");
  });

  test("Resolve and Delete act on the clicked comment", async ({ page }) => {
    await load(page, DOC);
    const first = page.locator("#the-doc aside.folio-comment").first();
    await first.click();
    await first.locator(".folio-comment-resolve").click();
    await expect(first).toHaveClass(/resolved/);
    let md = await source(page);
    expect(md).toContain("resolved: true");
    // Reopen, then delete from the palette.
    await view(page);
    await first.locator(".folio-comment-resolve").click();
    await expect(first).not.toHaveClass(/resolved/);
    await first.click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("delete comment");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc aside.folio-comment")).toHaveCount(1);
    md = await source(page);
    expect(md).not.toContain("::: comment {#c-1}");
    expect(md).toContain("::: comment {#c-2}");
  });

  test("the author name is asked once and remembered", async ({ page }) => {
    page.on("dialog", (d) => void d.accept("sam"));
    await load(page, "# T\n\nHello there.\n", "");
    await page.locator("#the-doc p", { hasText: "Hello there" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("add a comment");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc aside.folio-comment .folio-comment-author"),
    ).toHaveText("sam");
    expect(
      await page.evaluate(() => localStorage.getItem("folio-comment-author")),
    ).toBe("sam");
  });
});
