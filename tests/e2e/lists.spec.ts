import { expect, test, type Page } from "@playwright/test";
import { pickStyle } from "./toolbar-helpers";

/**
 * Lists (spec: docs/specs/lists.md): `- ` / `1. ` blocks render as
 * real lists, edit natively, and round-trip through the model.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
}

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return md;
}

test.describe("lists", () => {
  test("a Markdown list renders as a real list with live inline formatting", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "# T\n\nIntro:\n\n- One **bold**\n- Two [docs](demo/help.md)\n  wrapped\n\n1. First\n2. Second\n",
    );
    const ul = page.locator("#the-doc article > ul");
    await expect(ul.locator("li")).toHaveCount(2);
    await expect(ul.locator("li").first().locator("strong")).toHaveText("bold");
    await expect(ul.locator("li a")).toHaveText("docs");
    await expect(page.locator("#the-doc article > ol li")).toHaveCount(2);
  });

  test("the toolbar turns a paragraph into a list and back", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nalpha\n");
    await page.locator("#the-doc p", { hasText: "alpha" }).click();
    await page.locator('#block-bar button[data-block="ul"]').click();
    await expect(page.locator("#the-doc article > ul li")).toHaveText([
      "alpha",
    ]);
    await expect(
      page.locator('#block-bar button[data-block="ul"]'),
    ).toHaveClass(/active/);
    expect(await source(page)).toContain("\n- alpha\n");
    // Numbered switches the kind; pressing it again unlists.
    await page.locator("#the-doc li", { hasText: "alpha" }).click();
    await page.locator('#block-bar button[data-block="ol"]').click();
    await expect(page.locator("#the-doc article > ol li")).toHaveCount(1);
    await page.locator("#the-doc li", { hasText: "alpha" }).click();
    await page.locator('#block-bar button[data-block="ol"]').click();
    await expect(
      page.locator("#the-doc article > p", { hasText: "alpha" }),
    ).toBeVisible();
  });

  test("Enter adds an item; Enter on an empty item leaves the list", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- one\n");
    await page.locator("#the-doc li", { hasText: "one" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("two");
    await expect(page.locator("#the-doc article > ul li")).toHaveText([
      "one",
      "two",
    ]);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("after");
    await expect(page.locator("#the-doc article > ul li")).toHaveCount(2);
    const md = await source(page);
    expect(md).toContain("- one\n- two\n\nafter");
  });

  test("typing '- ' at the start of a paragraph starts a list", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nx\n");
    const p = page.locator("#the-doc p", { hasText: "x" });
    await p.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- ");
    await expect(page.locator("#the-doc article > ul")).toHaveCount(1);
    await page.keyboard.type("point");
    await expect(page.locator("#the-doc article > ul li")).toHaveText([
      "point",
    ]);
  });

  test("the palette finds the list commands", async ({ page }) => {
    await loadDoc(page, "# T\n\nbeta\n");
    await page.locator("#the-doc p", { hasText: "beta" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("numbered");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc article > ol li")).toHaveText(["beta"]);
  });

  test("the help document's bullets are lists, not dash paragraphs", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("folio-doc h1").first().waitFor();
    const help = page.locator("#help-doc");
    await expect(help.locator("article > ul").first()).toBeAttached();
    const dashParas = await help
      .locator("article > p")
      .evaluateAll(
        (ps) => ps.filter((p) => (p.textContent ?? "").startsWith("- ")).length,
      );
    expect(dashParas).toBe(0);
  });

  // Regressions found by the first-contact eval.
  test("the palette acts on the paragraph the caret is in, not the last clicked", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nAbove the new line,\nwrapped in the source.\n");
    await page.locator("#the-doc p", { hasText: "Above" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Apples");
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("bulleted list");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc article > ul li")).toHaveText([
      "Apples",
    ]);
    await expect(
      page.locator("#the-doc article > p", { hasText: "Above the new line" }),
    ).toBeVisible();
  });

  test("a wrapped paragraph becomes ONE item, not one per source line", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "# T\n\nOne sentence wrapped\nacross two source lines.\n",
    );
    await page.locator("#the-doc p", { hasText: "One sentence" }).click();
    await page.locator('#block-bar button[data-block="ul"]').click();
    await expect(page.locator("#the-doc article > ul li")).toHaveCount(1);
  });

  test("a list turned back into text gives one paragraph per item", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- Apples\n- Pears\n- Plums\n");
    await page.locator("#the-doc li", { hasText: "Pears" }).click();
    await pickStyle(page, "p");
    await expect(page.locator("#the-doc article > p")).toHaveText([
      "Apples",
      "Pears",
      "Plums",
    ]);
    expect(await source(page)).toContain("Apples\n\nPears\n\nPlums");
  });

  test("the palette can turn text back into a paragraph", async ({ page }) => {
    await loadDoc(page, "# T\n\n- solo\n");
    await page.locator("#the-doc li", { hasText: "solo" }).click();
    for (const words of ["paragraph", "normal text", "remove list"]) {
      await page.keyboard.press("Control+k");
      await page.locator("#palette-input").fill(words);
      await expect(
        page.locator("#palette-list .palette-item").first(),
      ).toContainText("Paragraph");
      await page.keyboard.press("Escape");
    }
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("ordered list");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Numbered list");
  });
});

test.describe("nested lists", () => {
  test("a nested Markdown list renders nested, mixed kinds", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "# T\n\n1. Prepare\n   - fonts\n   - colours\n2. Ship\n",
    );
    const top = page.locator("#the-doc article > ol");
    await expect(top.locator(":scope > li")).toHaveCount(2);
    await expect(top.locator(":scope > li > ul > li")).toHaveText([
      "fonts",
      "colours",
    ]);
  });

  test("Tab nests the item under the one above; Shift+Tab lifts it", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- one\n- two\n- three\n");
    await page.locator("#the-doc li", { hasText: "two" }).click();
    await page.keyboard.press("Tab");
    await expect(
      page.locator("#the-doc article > ul > li > ul > li"),
    ).toHaveText(["two"]);
    // The caret stayed in the item: typing continues there.
    await page.keyboard.press("End");
    await page.keyboard.type("!");
    await expect(
      page.locator("#the-doc article > ul > li > ul > li"),
    ).toHaveText(["two!"]);
    expect(await source(page)).toContain("- one\n  - two!\n- three\n");
    await page.locator("#the-doc li li", { hasText: "two!" }).click();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#the-doc article > ul > li")).toHaveText([
      "one",
      "two!",
      "three",
    ]);
  });

  test("Tab on a list's first item does nothing (there is no parent)", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- one\n- two\n");
    await page.locator("#the-doc li", { hasText: "one" }).click();
    await page.keyboard.press("Tab");
    await expect(page.locator("#the-doc article > ul > li")).toHaveCount(2);
  });

  test("Shift+Tab keeps later siblings after the lifted item", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- a\n  - b\n  - c\n  - d\n");
    await page.locator("#the-doc li", { hasText: /^c$/ }).click();
    await page.keyboard.press("Shift+Tab");
    expect(await source(page)).toContain("- a\n  - b\n- c\n  - d\n");
  });

  test("Enter on an empty nested item lifts it a level", async ({ page }) => {
    await loadDoc(page, "# T\n\n- a\n  - b\n");
    await page.locator("#the-doc li", { hasText: /^b$/ }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("c");
    expect(await source(page)).toContain("- a\n  - b\n- c\n");
  });

  test("the palette indents and outdents", async ({ page }) => {
    await loadDoc(page, "# T\n\n- one\n- two\n");
    await page.locator("#the-doc li", { hasText: "two" }).click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("indent list item");
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#the-doc article > ul > li > ul > li"),
    ).toHaveText(["two"]);
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("outdent");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc article > ul > li")).toHaveCount(2);
  });

  // Regressions from the nested-lists first-contact eval.
  test("the list buttons switch the SUB-list the caret is in", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "# T\n\n1. Prepare\n   1. fonts\n   2. colours\n2. Ship\n",
    );
    await page.locator("#the-doc li li", { hasText: "fonts" }).click();
    await page.locator('#block-bar button[data-block="ul"]').click();
    await expect(
      page.locator("#the-doc article > ol > li > ul > li"),
    ).toHaveText(["fonts", "colours"]);
    await expect(page.locator("#the-doc article > ol")).toHaveCount(1);
    await expect(
      page.locator('#block-bar button[data-block="ul"]'),
    ).toHaveClass(/active/);
    expect(await source(page)).toContain(
      "1. Prepare\n   - fonts\n   - colours\n2. Ship\n",
    );
  });

  test("typing '- ' in an empty item makes its list bulleted", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n1. Prepare\n");
    await page.locator("#the-doc li", { hasText: "Prepare" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.type("- fonts");
    await expect(
      page.locator("#the-doc article > ol > li > ul > li"),
    ).toHaveText(["fonts"]);
  });

  test("the palette finds indent by other words, and shows the key", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- one\n- two\n");
    await page.locator("#the-doc li", { hasText: "two" }).click();
    for (const [words, title] of [
      ["demote", "Indent list item (Tab)"],
      ["increase indent", "Indent list item (Tab)"],
      ["promote", "Outdent list item (Shift+Tab)"],
    ] as const) {
      await page.keyboard.press("Control+k");
      await page.locator("#palette-input").fill(words);
      await expect(
        page.locator("#palette-list .palette-item").first(),
      ).toContainText(title);
      await page.keyboard.press("Escape");
    }
  });

  test("Shift+Tab on a top-level item makes it a paragraph; numbering continues", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n1. a\n2. b\n3. c\n");
    await page.locator("#the-doc li", { hasText: /^b$/ }).click();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.locator("#the-doc article > p", { hasText: "b" }),
    ).toBeVisible();
    // The caret stayed: typing goes into the new paragraph.
    await page.keyboard.press("End");
    await page.keyboard.type("!");
    expect(await source(page)).toContain("1. a\n\nb!\n\n3. c\n");
  });

  test("Backspace at an item's start removes the bullet before merging", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- one\n  - two\n- three\n");
    await page.locator("#the-doc li li", { hasText: "two" }).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Backspace");
    // Nested: lifts a level first.
    await expect(page.locator("#the-doc article > ul > li")).toHaveCount(3);
    await page.keyboard.press("Backspace");
    // Top level: becomes a paragraph between the two halves.
    await expect(
      page.locator("#the-doc article > p", { hasText: "two" }),
    ).toBeVisible();
    expect(await source(page)).toContain("- one\n\ntwo\n\n- three\n");
  });

  test("the bullet button stays lit after Tab and Shift+Tab", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n- one\n- two\n");
    await page.locator("#the-doc li", { hasText: "two" }).click();
    await page.keyboard.press("Tab");
    const bullet = page.locator('#block-bar button[data-block="ul"]');
    await expect(bullet).toHaveClass(/active/);
    await page.keyboard.press("Shift+Tab");
    await expect(bullet).toHaveClass(/active/);
  });
});
