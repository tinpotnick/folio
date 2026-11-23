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

  test("the author name is asked once in the dialog and remembered", async ({
    page,
  }) => {
    await load(page, "# T\n\nHello there.\n", "");
    const modal = page.locator("#author-modal");
    await page.locator("#the-doc p", { hasText: "Hello there" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("add a comment");
    await page.keyboard.press("Enter");
    // No name stored: the author dialog opens before the insert.
    await expect(modal).toBeVisible();
    await page.locator("#author-input").fill("sam");
    await page.locator("#btn-author-save").click();
    await expect(
      page.locator("#the-doc aside.folio-comment .folio-comment-author"),
    ).toHaveText("sam");
    expect(
      await page.evaluate(() => localStorage.getItem("folio-comment-author")),
    ).toBe("sam");
    // A second comment uses the remembered name - no dialog.
    await page.locator("#the-doc p", { hasText: "Hello there" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("add a comment");
    await page.keyboard.press("Enter");
    await expect(modal).toBeHidden();
    await expect(
      page.locator("#the-doc aside.folio-comment .folio-comment-author"),
    ).toHaveCount(2);
    await expect(
      page.locator("#the-doc aside.folio-comment .folio-comment-author").last(),
    ).toHaveText("sam");
  });

  test("Set comment author from the palette, the context menu, and the comment's author name", async ({
    page,
  }) => {
    await load(page, DOC); // author "nick" stored
    const modal = page.locator("#author-modal");
    // Palette: prefilled with the stored name; Enter in the input saves.
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("set comment author");
    await page.keyboard.press("Enter");
    await expect(modal).toBeVisible();
    await expect(page.locator("#author-input")).toHaveValue("nick");
    await page.locator("#author-input").fill("sam");
    await page.keyboard.press("Enter");
    await expect(modal).toBeHidden();
    expect(
      await page.evaluate(() => localStorage.getItem("folio-comment-author")),
    ).toBe("sam");
    // Clicking the author name on a comment opens the same dialog.
    await page
      .locator("#the-doc aside.folio-comment .folio-comment-author")
      .first()
      .click();
    await expect(modal).toBeVisible();
    await expect(page.locator("#author-input")).toHaveValue("sam");
    await page.locator("#btn-author-cancel").click();
    await expect(modal).toBeHidden();
    // The right-click menu's entry opens it too.
    await page.locator("#the-doc p").first().dispatchEvent("contextmenu", {
      bubbles: true,
      composed: true,
      cancelable: true,
      clientX: 120,
      clientY: 120,
    });
    await page
      .locator("#the-doc .folio-doc-menu button", {
        hasText: "Set comment author",
      })
      .click();
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    // The new name is stamped on the next comment.
    await page.locator("#the-doc p").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("add a comment");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc aside.folio-comment .folio-comment-author").last(),
    ).toHaveText("sam");
  });

  test("saving a new author renames the comments written under the old name", async ({
    page,
  }) => {
    // Stored "nick"; c-1 is by nick, c-2 by sam.
    await load(page, DOC);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("set comment author");
    await page.keyboard.press("Enter");
    await page.locator("#author-input").fill("Nicky");
    await page.locator("#btn-author-save").click();
    // c-1 renamed, c-2 (another author) untouched.
    const authors = page.locator(
      "#the-doc aside.folio-comment .folio-comment-author",
    );
    await expect(authors.nth(0)).toHaveText("Nicky");
    await expect(authors.nth(1)).toHaveText("sam");
    const md = await source(page);
    expect(md).not.toContain("author: nick");
    expect(md).toContain("author: Nicky");
    expect(md).toContain("author: sam");
  });
});

test.describe("comments at the end of the document", () => {
  test("clicking below a trailing comment offers a paragraph there", async ({
    page,
  }) => {
    await load(
      page,
      "# T\n\nText.\n\n::: comment {#c-1}\nauthor: nick\nA note.\n:::\n",
    );
    const aside = page.locator("#the-doc aside.folio-comment");
    await expect(aside).toHaveCount(1);
    const box = await aside.boundingBox();
    await page.mouse.click(
      (box?.x ?? 0) + 20,
      (box?.y ?? 0) + (box?.height ?? 0) + 40,
    );
    await expect(page.locator("#the-doc p")).toHaveCount(2);
    await page.keyboard.type("after the comment");
    const md = await source(page);
    expect(md).toContain("after the comment");
    expect(md).toContain("::: comment {#c-1}");
  });

  test("Enter with a trailing comment selected appends a paragraph", async ({
    page,
  }) => {
    await load(
      page,
      "# T\n\nText.\n\n::: comment {#c-1}\nauthor: nick\nA note.\n:::\n",
    );
    const aside = page.locator("#the-doc aside.folio-comment");
    // Click the aside's own padding (not a head button - the author name
    // now opens the author dialog) so the comment block owns the key.
    await aside.click({ position: { x: 6, y: 6 } });
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc p")).toHaveCount(2);
    // The caret is in the new paragraph: typing lands there.
    await page.keyboard.type("past the comment");
    const md = await source(page);
    expect(md).toContain("past the comment");
    expect(md.indexOf("::: comment")).toBeLessThan(
      md.indexOf("past the comment"),
    );
  });
});
