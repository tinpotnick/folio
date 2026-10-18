import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end coverage of the demo host page (index.html + src/main.ts)
 * against the sample document (demo/sample-document.md). Playwright
 * locators pierce the open shadow root of <folio-doc>, so component
 * internals are addressed with plain CSS selectors.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

function caretIn(page: Page, needle: string, offset = 1): Promise<void> {
  return page.evaluate(
    ({ n, o }) => {
      const ta = document.querySelector("#editor") as HTMLTextAreaElement;
      const idx = ta.value.indexOf(n);
      ta.focus();
      ta.setSelectionRange(idx + o, idx + o);
      ta.dispatchEvent(new Event("click", { bubbles: true }));
    },
    { n: needle, o: offset },
  );
}

test.describe("document view", () => {
  test("renders the sample document with table and chart", async ({ page }) => {
    await waitForDocument(page);
    const doc = page.locator("folio-doc article.folio-doc");
    await expect(
      doc.locator("h2", { hasText: "Regional summary" }),
    ).toBeVisible();
    await expect(doc.locator("figure table").first()).toBeVisible();
    await expect(doc.locator("figure svg[role='img']").first()).toBeVisible();
  });

  test("web degradation: native Open/Save stay hidden", async ({ page }) => {
    await waitForDocument(page);
    await expect(page.locator("#btn-open")).toBeHidden();
    await expect(page.locator("#btn-save")).toBeHidden();
    await expect(page.locator("#btn-help")).toBeVisible();
  });

  test("Table button inserts a table block and confirms via status", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("folio-doc figure table").count();
    await page.locator("#btn-table").click();
    await expect(
      page.locator("#status", { hasText: "Table inserted" }),
    ).toBeVisible();
    await expect(page.locator("folio-doc figure table")).toHaveCount(
      before + 1,
    );
  });
});

test.describe("markdown source view", () => {
  test("shows highlighted source with a line-number gutter", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#the-doc")).toBeHidden();

    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("# Q3 Field Operations Review");
    expect(source).toContain("---");

    await expect(
      page.locator("#md-view span.tk-heading", {
        hasText: "# Q3 Field Operations Review",
      }),
    ).toBeVisible();
    await expect(
      page
        .locator("#md-view span.tk-frontmatter-delim", { hasText: "---" })
        .first(),
    ).toBeVisible();

    const gutter = await page.locator("#md-gutter").textContent();
    expect(gutter?.split("\n").slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  test("edited source round-trips back into the rendered view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await page
      .locator("#editor")
      .fill("# Edited heading\n\nFresh paragraph.\n");
    await page.locator("#btn-view").click();

    await expect(
      page.locator("#status", { hasText: "Parsed OK" }),
    ).toBeVisible();
    await expect(
      page.locator("folio-doc h1", { hasText: "Edited heading" }),
    ).toBeVisible();
    await expect(
      page.locator("folio-doc p", { hasText: "Fresh paragraph." }),
    ).toBeVisible();
    await expect(page.locator("#editor")).toBeHidden();
  });

  test("invalid source reports a parse error and stays in source view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill("::: table {#broken}\nnot a table\n");
    await page.locator("#btn-view").click();

    await expect(page.locator("#status")).toContainText("Parse error");
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#the-doc")).toBeHidden();
  });
});

test.describe("section browser", () => {
  test("lists every heading and reveals the clicked section", async ({
    page,
  }) => {
    await waitForDocument(page);
    const sidebar = page.locator("#sidebar");
    await expect(sidebar).toBeHidden();
    await page.locator("#btn-sidebar").click();
    await expect(sidebar).toBeVisible();

    const outline = page.locator("#outline button");
    await expect(outline).toHaveCount(2);
    await expect(outline.first()).toHaveText("Q3 Field Operations Review");
    await expect(outline.nth(1)).toHaveText("Regional summary");

    await outline.nth(1).click();
    const focused = await page.evaluate(() => {
      const host = document.querySelector("folio-doc");
      return host?.shadowRoot?.activeElement?.textContent ?? "";
    });
    expect(focused).toContain("Regional summary");
  });

  test("Sections button toggles the sidebar", async ({ page }) => {
    await waitForDocument(page);
    const sidebar = page.locator("#sidebar");

    await page.locator("#btn-sidebar").click();
    await expect(sidebar).toBeVisible();

    await page.locator("#btn-sidebar").click();
    await expect(sidebar).toBeHidden();
  });
});

test.describe("edits keep the document the single source of truth", () => {
  test("typing in document view syncs the Markdown source", async ({
    page,
  }) => {
    await waitForDocument(page);

    const intro = page.locator("folio-doc p", { hasText: "Revenue recovered" });
    await intro.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" (updated)");

    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("(updated)");
  });
});

test.describe("in-app help", () => {
  test("Help button opens the help document; Close dismisses it", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();

    const modal = page.locator("#help-modal");
    await expect(modal).toBeVisible();
    await expect(
      page.locator("#help-doc h1", { hasText: "folio help" }),
    ).toBeVisible();
    await expect(page.locator("#help-doc figure table").first()).toBeVisible();
    await expect(
      page.locator("#help-doc p", { hasText: "copy the source" }),
    ).toBeVisible();

    await page.locator("#btn-help-close").click();
    await expect(modal).toBeHidden();
  });

  test("Esc closes the help window", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await expect(page.locator("#help-modal")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#help-modal")).toBeHidden();
  });

  test("? and F1 open help; not while typing in the source editor", async ({
    page,
  }) => {
    await waitForDocument(page);
    const modal = page.locator("#help-modal");

    await page.keyboard.press("?");
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("F1");
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    await page.locator("#btn-markdown").click();
    await page.locator("#editor").click();
    await page.keyboard.press("?");
    await expect(modal).toBeHidden();
  });
});

test.describe("toolbar context state and actions", () => {
  const h1Btn = '#block-bar button[data-block="h1"]';
  const pBtn = '#block-bar button[data-block="p"]';
  const boldBtn = '#fmt-bar button[data-cmd="bold"]';

  test("document view: buttons reflect the block and inline format at the caret", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page
      .locator("folio-doc h1", { hasText: "Q3 Field Operations Review" })
      .click();
    await expect(page.locator(h1Btn)).toHaveClass(/active/);
    await expect(page.locator(pBtn)).not.toHaveClass(/active/);
    // Markdown-true: a heading carries no inline emphasis, so B is
    // neither lit nor available there — even though headings render
    // in a bold face.
    await expect(page.locator(boldBtn)).not.toHaveClass(/active/);
    await expect(page.locator(boldBtn)).toBeDisabled();

    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(page.locator(pBtn)).toHaveClass(/active/);
    await expect(page.locator(h1Btn)).not.toHaveClass(/active/);
    await expect(page.locator(boldBtn)).toBeEnabled();
    await expect(page.locator(boldBtn)).not.toHaveClass(/active/);

    await page.locator("folio-doc strong", { hasText: "Midlands" }).click();
    await expect(page.locator(boldBtn)).toHaveClass(/active/);
  });

  test("arrow keys move the reflected block with the caret", async ({
    page,
  }) => {
    await waitForDocument(page);

    // Click near the top of the first paragraph line, then walk up to
    // the heading and back down.
    await page
      .locator("folio-doc p", { hasText: "Revenue recovered" })
      .click({ position: { x: 10, y: 4 } });
    await expect(page.locator(pBtn)).toHaveClass(/active/);

    await page.keyboard.press("ArrowUp");
    await expect(page.locator(h1Btn)).toHaveClass(/active/);
    await expect(page.locator(boldBtn)).toBeDisabled();

    await page.keyboard.press("ArrowDown");
    await expect(page.locator(pBtn)).toHaveClass(/active/);
    await expect(page.locator(h1Btn)).not.toHaveClass(/active/);
  });

  test("markdown view: buttons reflect the line prefix and inline token at the caret", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await caretIn(page, "# Q3 Field Operations Review", 3);
    await expect(page.locator(h1Btn)).toHaveClass(/active/);
    await expect(page.locator(boldBtn)).not.toHaveClass(/active/);
    await expect(page.locator(boldBtn)).toBeDisabled();

    await caretIn(page, "Revenue recovered", 3);
    await expect(page.locator(pBtn)).toHaveClass(/active/);
    await expect(page.locator(h1Btn)).not.toHaveClass(/active/);
    await expect(page.locator(boldBtn)).toBeEnabled();

    await caretIn(page, "**Midlands**", 5);
    await expect(page.locator(boldBtn)).toHaveClass(/active/);
  });

  test("markdown view: H1/P buttons rewrite the line prefix", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await caretIn(page, "Revenue recovered", 3);
    await page.locator(h1Btn).click();
    let source = await page.locator("#editor").inputValue();
    expect(source).toContain("# Revenue recovered");

    await page.locator(pBtn).click();
    source = await page.locator("#editor").inputValue();
    expect(source).toContain("\nRevenue recovered");
    expect(source).not.toContain("# Revenue recovered");
  });

  test("markdown view: B toggles ** around the selection", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await caretIn(page, "**Midlands**", 5);
    await page.locator(boldBtn).click();
    let source = await page.locator("#editor").inputValue();
    expect(source).toContain("Midlands");
    expect(source).not.toContain("**Midlands**");

    await caretIn(page, "Revenue recovered", 3);
    await page.locator(boldBtn).click();
    source = await page.locator("#editor").inputValue();
    expect(source).toContain("**Revenue**");
  });
});

test.describe("table editing and keyboard navigation", () => {
  const td = (r: number, c: number) =>
    `#the-doc td[data-row-index="${r}"][data-col-index="${c}"]`;

  function focusedCell(page: Page): Promise<string> {
    return page.evaluate(() => {
      const a = document.querySelector("folio-doc")?.shadowRoot?.activeElement;
      const el = a as HTMLElement;
      return `${el.dataset.rowIndex ?? "?"}:${el.dataset.colIndex ?? "?"}`;
    });
  }

  test("cell edits commit, formulas recalculate, data survives the Markdown view", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page.locator(td(0, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");

    // Tab moved to the next editable cell (q3), not the toolbar.
    expect(await focusedCell(page)).toBe("0:2");
    await page.keyboard.press("Control+a");
    await page.keyboard.type("500");
    await page.keyboard.press("Tab");

    // From q3 (last editable col) Tab wraps to the next row's first cell.
    expect(await focusedCell(page)).toBe("1:0");

    // The formula column recalculated for the edited row.
    await expect(page.locator(td(0, 3))).toHaveText("25.0%");
    await expect(
      page.locator("folio-doc figure svg[role='img']").first(),
    ).toBeVisible();

    // Nothing is lost on the Markdown round-trip.
    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("[North, 400, 500]");
    expect(source).not.toContain("412");
  });

  test("Tab past the last row grows the table", async ({ page }) => {
    await waitForDocument(page);

    const before = await page.locator("#the-doc tbody tr").count();
    await page.locator(td(2, 2)).click();
    await page.keyboard.press("Tab");

    expect(await focusedCell(page)).toBe("3:0");
    await expect(page.locator("#the-doc tbody tr")).toHaveCount(before + 1);
  });

  test("Enter moves down a column and grows the table at the bottom", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page.locator(td(0, 0)).click();
    await page.keyboard.press("Enter");
    expect(await focusedCell(page)).toBe("1:0");

    const before = await page.locator("#the-doc tbody tr").count();
    await page.locator(td(2, 1)).click();
    await page.keyboard.press("Enter");
    expect(await focusedCell(page)).toBe("3:1");
    await expect(page.locator("#the-doc tbody tr")).toHaveCount(before + 1);
  });
});

test.describe("markdown+ inline formats", () => {
  const strikeBtn = '#fmt-bar button[data-cmd="strike"]';
  const underlineBtn = '#fmt-bar button[data-cmd="underline"]';

  test("markdown view: strike and underline toggle around the selection", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await caretIn(page, "**Midlands**", 5);
    await page.locator(strikeBtn).click();
    let source = await page.locator("#editor").inputValue();
    expect(source).toContain("**~~Midlands~~**");

    await caretIn(page, "**~~Midlands~~**", 7);
    await page.locator(strikeBtn).click();
    source = await page.locator("#editor").inputValue();
    expect(source).toContain("**Midlands**");
    expect(source).not.toContain("~~Midlands~~");

    await caretIn(page, "Revenue recovered", 3);
    await page.locator(underlineBtn).click();
    source = await page.locator("#editor").inputValue();
    expect(source).toContain("++Revenue++");
  });

  test("markdown view: strike and underline light up at the caret", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await caretIn(page, "Revenue recovered", 3);
    await page.locator(underlineBtn).click();
    await caretIn(page, "++Revenue++", 5);
    await expect(page.locator(underlineBtn)).toHaveClass(/active/);

    await caretIn(page, "service outage", 10);
    await page.locator(strikeBtn).click();
    await caretIn(page, "~~outage~~", 5);
    await expect(page.locator(strikeBtn)).toHaveClass(/active/);
  });

  test("document view: strike and underline render and round-trip", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await caretIn(page, "**Midlands**", 5);
    await page.locator(strikeBtn).click();
    await page.locator("#btn-view").click();

    await expect(
      page.locator("folio-doc del", { hasText: "Midlands" }),
    ).toBeVisible();
    await page.locator("folio-doc del", { hasText: "Midlands" }).click();
    await expect(page.locator(strikeBtn)).toHaveClass(/active/);
  });
});

test.describe("code blocks", () => {
  const codeBtn = '#fmt-bar button[data-cmd="code"]';

  test("fences in the source render as a code block and round-trip", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill("# Title\n\n```js\nconst x = 1;\nconst y = 2;\n```\n");
    await page.locator("#btn-view").click();

    const pre = page.locator("#the-doc pre.folio-code");
    await expect(pre).toBeVisible();
    await expect(pre.locator("code")).toHaveText("const x = 1;\nconst y = 2;");
    await expect(pre).toHaveAttribute("data-lang", "js");

    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("```js\nconst x = 1;\nconst y = 2;\n```");
  });

  test("the code button converts the caret's block to a code block and back", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator(codeBtn).click();
    const pre = page.locator("#the-doc pre.folio-code");
    await expect(pre).toBeVisible();
    await expect(pre.locator("code")).toContainText("Revenue recovered");
    await expect(page.locator(codeBtn)).toHaveClass(/active/);

    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain("```\n");

    await page.locator("#btn-view").click();
    await pre.click();
    await page.locator(codeBtn).click();
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).toBeVisible();
  });

  test("Enter inside a code block inserts a newline, not a block split", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill("# T\n\n```\nalpha beta\n```\n");
    await page.locator("#btn-view").click();

    const pre = page.locator("#the-doc pre.folio-code");
    await pre.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("gamma");

    const rendered = await pre
      .locator("code")
      .evaluate((el) => (el as HTMLElement).innerText);
    expect(rendered).toMatch(/alpha beta\n+gamma/);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /alpha beta\n+gamma/,
    );
  });
});
