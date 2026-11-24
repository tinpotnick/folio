import { expect, test, type Page } from "@playwright/test";
import { insertFrom, pickStyle } from "./toolbar-helpers";

/**
 * End-to-end coverage of the demo host page (index.html + src/main.ts)
 * against the sample document (demo/examples/field-operations.md, booted via ?doc=). Playwright
 * locators pierce the open shadow root of <folio-doc>, so component
 * internals are addressed with plain CSS selectors.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
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

  test("the web host has New, Open and Save (docs/specs/web-files.md)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await expect(page.locator("#btn-new")).toBeVisible();
    await expect(page.locator("#btn-open")).toBeVisible();
    await expect(page.locator("#btn-save")).toBeVisible();
    await expect(page.locator("#btn-help")).toBeVisible();
  });

  test("Table button inserts a table block and confirms via status", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("folio-doc figure table").count();
    await insertFrom(page, "btn-table");
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

  test("a huge data-URI line is one overlay row; editor never soft-wraps", async ({
    page,
  }) => {
    await waitForDocument(page);
    const big =
      "# T\n\n::: audio {#c}\nsrc: data:audio/wav;base64," +
      "A".repeat(60000) +
      "\n:::\n\n" +
      "B".repeat(60000) +
      "\n";
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill(big);
    await page.locator("#btn-view").click();
    await expect(page.locator("#the-doc figure.folio-audio")).toBeVisible();
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#editor")).toBeVisible();
    // Caret at the top: the huge line must render truncated, not full.
    await page.evaluate(() => {
      const ed = document.querySelector("#editor") as HTMLTextAreaElement;
      ed.setSelectionRange(0, 0);
      ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    });
    // No soft wrap: the textarea scrolls sideways, the overlay pans.
    await expect(page.locator("#editor")).toHaveAttribute("wrap", "off");
    const editor = page.locator("#editor");
    const lineCount = (await editor.inputValue()).split("\n").length;
    await expect(page.locator("#md-view .ln")).toHaveCount(lineCount);
    await editor.evaluate((el) => {
      (el as HTMLTextAreaElement).scrollLeft = 5000;
      el.dispatchEvent(new Event("scroll"));
    });
    const panned = await page.evaluate(() => {
      const view = document.querySelector("#md-view") as HTMLElement;
      return view.scrollLeft;
    });
    expect(panned).toBe(5000);
    // The source view is a fixed-height box (the textarea scrolls inside
    // it); the overlay and gutter pan in sync on both axes.
    const heights = await page.evaluate(() => {
      const ed = document.querySelector("#editor") as HTMLTextAreaElement;
      ed.scrollTop = 120;
      ed.dispatchEvent(new Event("scroll"));
      const wrap = document.querySelector("#md-wrap") as HTMLElement;
      const view = document.querySelector("#md-view") as HTMLElement;
      const gutter = document.querySelector("#md-gutter") as HTMLElement;
      return {
        editorH: ed.getBoundingClientRect().height,
        wrapH: wrap.getBoundingClientRect().height,
        wideOverflow: ed.scrollWidth > ed.clientWidth, // internal h-scroll
        edTop: ed.scrollTop,
        viewTop: view.scrollTop,
        gutterTop: gutter.scrollTop,
      };
    });
    expect(heights.editorH).toBeCloseTo(heights.wrapH, 0); // fills the box
    expect(heights.wideOverflow).toBe(true);
    expect(heights.viewTop).toBe(heights.edTop);
    expect(heights.gutterTop).toBe(heights.edTop);
    // The data-URI line renders as ONE compact row with a data chip (mime
    // + size), not a 60k-char text run; a huge non-data line truncates.
    const compact = await page.evaluate(() => {
      const view = document.querySelector("#md-view") as HTMLElement;
      const rows = Array.from(view.querySelectorAll(".ln"));
      const audioRow = rows.find((r) =>
        (r.textContent ?? "").includes("base64"),
      );
      const chip = audioRow?.querySelector(".tk-data");
      const blobRow = rows.find((r) =>
        /^B+$/.test((r.textContent ?? "").slice(0, 100)),
      );
      const mark = blobRow?.querySelector(".tk-trunc");
      return {
        audioLen: (audioRow?.textContent ?? "").length,
        audioHeight: audioRow?.getBoundingClientRect().height ?? -1,
        chipText: chip?.textContent ?? "",
        noTruncOnAudio: !audioRow?.querySelector(".tk-trunc"),
        blobLen: (blobRow?.textContent ?? "").length,
        blobMarker: mark?.textContent ?? "",
      };
    });
    expect(compact.audioLen).toBeLessThan(100); // chip, not 60k
    expect(compact.audioHeight).toBeGreaterThan(0);
    expect(compact.audioHeight).toBeLessThan(60); // one row, no wrap explosion
    expect(compact.chipText).toMatch(
      /^data:audio\/wav;base64 \[\d+(\.\d+)? kB\]$/,
    );
    expect(compact.noTruncOnAudio).toBe(true);
    expect(compact.blobLen).toBeLessThan(1100); // truncated prefix + marker
    expect(compact.blobMarker).toMatch(/^ …\(\+\d+\)$/);
    // The textarea keeps the full text (it is the model - round-trip).
    await expect(page.locator("#editor")).toHaveValue(/A{60000}/);
    await expect(page.locator("#editor")).toHaveValue(/B{60000}/);
    // Moving the caret into the chipped line expands it to the raw URI.
    await page.evaluate(() => {
      const ed = document.querySelector("#editor") as HTMLTextAreaElement;
      const pos = ed.value.indexOf("base64,") + 10;
      ed.focus();
      ed.setSelectionRange(pos, pos);
      ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    });
    const expanded = await page.evaluate(() => {
      const view = document.querySelector("#md-view") as HTMLElement;
      const rows = Array.from(view.querySelectorAll(".ln"));
      const long = rows.find((r) => (r.textContent ?? "").includes("base64,"));
      return {
        textLen: (long?.textContent ?? "").length,
        hasChip: !!long?.querySelector(".tk-data"),
      };
    });
    expect(expanded.textLen).toBeGreaterThan(50000);
    expect(expanded.hasChip).toBe(false);
    // Moving the caret out chips it again.
    await page.evaluate(() => {
      const ed = document.querySelector("#editor") as HTMLTextAreaElement;
      ed.setSelectionRange(0, 0);
      ed.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    });
    const rechipped = await page.evaluate(() => {
      const view = document.querySelector("#md-view") as HTMLElement;
      const rows = Array.from(view.querySelectorAll(".ln"));
      const long = rows.find((r) => (r.textContent ?? "").includes("base64"));
      return {
        textLen: (long?.textContent ?? "").length,
        hasChip: !!long?.querySelector(".tk-data"),
      };
    });
    expect(rechipped.textLen).toBeLessThan(100);
    expect(rechipped.hasChip).toBe(true);
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
    await expect(outline).toHaveCount(4);
    await expect(outline.first()).toHaveText("Q3 Field Operations Review");
    await expect(outline.nth(1)).toHaveText("Regional summary");
    await expect(outline.nth(2)).toHaveText("Cumulative view");
    await expect(outline.nth(3)).toHaveText("More examples");

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
  const panel = (page: Page) => page.locator("#help-panel");
  const helpH1 = (page: Page) => page.locator("#help-doc h1").first();

  test("help docks beside the document: topics, a topic, back, close", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await expect(panel(page)).toBeVisible();
    await expect(page.locator("#btn-help")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(helpH1(page)).toHaveText("folio help");
    // Beside the document, not over it: both in view, side by side.
    const doc = await page.locator("#the-doc").boundingBox();
    const box = await panel(page).boundingBox();
    expect((doc?.x ?? 0) + (doc?.width ?? 0)).toBeLessThanOrEqual(
      (box?.x ?? 0) + 1,
    );
    // A topic from the list opens in the panel.
    await page
      .locator("#help-doc a", { hasText: "Opening and saving" })
      .click();
    await expect(helpH1(page)).toHaveText("Opening and saving");
    await expect(
      page.locator("#help-doc li", { hasText: "is uploaded anywhere" }),
    ).toBeVisible();
    await page.locator("#btn-help-home").click();
    await expect(helpH1(page)).toHaveText("folio help");
    await expect(page.locator("#btn-help-home")).toBeHidden();
    await page.locator("#btn-help-close").click();
    await expect(panel(page)).toBeHidden();
  });

  test("the document stays editable while help is open", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await page.locator("#the-doc p").first().click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Typed beside help.");
    await expect(page.locator("#the-doc p").first()).toContainText(
      "Typed beside help.",
    );
    await expect(panel(page)).toBeVisible();
  });

  test("the help search finds a topic by what it says", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    // The search box has the focus on opening.
    await page.keyboard.type("stacked");
    await expect(page.locator("#help-results button").first()).toContainText(
      "Charts",
    );
    await page.keyboard.press("Enter");
    await expect(helpH1(page)).toHaveText("Charts");
    await page.locator("#help-search").fill("zzqx");
    await expect(page.locator("#help-results")).toContainText(
      'No help topic mentions "zzqx"',
    );
  });

  test("Esc clears the help search, then closes the panel", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    await page.keyboard.type("lists");
    await page.keyboard.press("Escape");
    await expect(page.locator("#help-search")).toHaveValue("");
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
  });

  test("? toggles help; not while typing in the source editor", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("?");
    await expect(panel(page)).toBeVisible();
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("?");
    await expect(panel(page)).toBeHidden();
    await page.keyboard.press("F1");
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();

    await page.locator("#btn-markdown").click();
    await page.locator("#editor").click();
    await page.keyboard.press("?");
    await expect(panel(page)).toBeHidden();
  });

  test("F1 opens and closes help, even mid-typing, and typing carries on", async ({
    page,
  }) => {
    await waitForDocument(page);
    // From the toolbar's focus: F1 opens, F1 again closes.
    await page.locator("#btn-help").focus();
    await page.keyboard.press("F1");
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("F1");
    await expect(panel(page)).toBeHidden();
    // Mid-typing in the document: the caret stays put.
    const para = page.locator("#the-doc p").first();
    await para.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" one");
    await page.keyboard.press("F1");
    await expect(panel(page)).toBeVisible();
    await page.keyboard.type(" two");
    await page.keyboard.press("F1");
    await expect(panel(page)).toBeHidden();
    await expect(para).toContainText("one two");
    // In the Markdown source too.
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").click();
    await page.keyboard.press("F1");
    await expect(panel(page)).toBeVisible();
  });

  test("a narrow window: the panel slides over, under the toolbar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 760, height: 800 });
    await waitForDocument(page);
    await page.locator("#btn-help").click();
    const head = await page.locator("header").first().boundingBox();
    const box = await panel(page).boundingBox();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(
      (head?.y ?? 0) + (head?.height ?? 0) - 1,
    );
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(801);
    await expect(page.locator("#btn-help-close")).toBeInViewport();
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
    await pickStyle(page, "h1");
    let source = await page.locator("#editor").inputValue();
    expect(source).toContain("# Revenue recovered");

    await pickStyle(page, "p");
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
    `#the-doc figure[data-table-id="regional-data"] td[data-row-index="${r}"][data-col-index="${c}"]`;

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

    const before = await page
      .locator('#the-doc figure[data-table-id="regional-data"] tbody tr')
      .count();
    await page.locator(td(2, 2)).click();
    await page.keyboard.press("Tab");

    expect(await focusedCell(page)).toBe("3:0");
    await expect(
      page.locator('#the-doc figure[data-table-id="regional-data"] tbody tr'),
    ).toHaveCount(before + 1);
  });

  test("Enter moves down a column and grows the table at the bottom", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page.locator(td(0, 0)).click();
    await page.keyboard.press("Enter");
    expect(await focusedCell(page)).toBe("1:0");

    const before = await page
      .locator('#the-doc figure[data-table-id="regional-data"] tbody tr')
      .count();
    await page.locator(td(2, 1)).click();
    await page.keyboard.press("Enter");
    expect(await focusedCell(page)).toBe("3:1");
    await expect(
      page.locator('#the-doc figure[data-table-id="regional-data"] tbody tr'),
    ).toHaveCount(before + 1);
  });

  test("ArrowUp/ArrowDown move one row up/down in the SAME column", async ({
    page,
  }) => {
    await waitForDocument(page);

    // The browser's native arrows move by visual position, which
    // lands in a different column when columns differ in width; the
    // grid keys must keep the column.
    await page.locator(td(1, 0)).click();
    await page.keyboard.press("ArrowUp");
    expect(await focusedCell(page)).toBe("0:0");
    await page.keyboard.press("ArrowDown");
    expect(await focusedCell(page)).toBe("1:0");
    await page.keyboard.press("ArrowDown");
    expect(await focusedCell(page)).toBe("2:0");

    // Arrows never grow the table (Enter/Tab do): at the last row the
    // key leaves the table to the browser instead.
    const before = await page
      .locator('#the-doc figure[data-table-id="regional-data"] tbody tr')
      .count();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.locator('#the-doc figure[data-table-id="regional-data"] tbody tr'),
    ).toHaveCount(before);
  });

  test("clicking past the end of a column heading puts the caret at the end of its name", async ({
    page,
  }) => {
    await waitForDocument(page);

    // The heading cell is much wider than its name: clicking at the
    // right of the cell (where a new column's short default heading
    // ends) must put the caret at the END of the name, not leave it
    // at the start / outside the name.
    const th = page.locator(
      '#the-doc figure[data-table-id="regional-data"] thead th[data-col-index="0"]',
    );
    const box = await th.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(
      (box as { x: number; y: number; width: number; height: number }).x +
        (box as { width: number }).width -
        3,
      (box as { y: number; height: number }).y +
        (box as { height: number }).height / 2,
    );
    const caret = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot as
        (ShadowRoot & { getSelection?: () => Selection }) | undefined;
      const sel = root?.getSelection?.() ?? window.getSelection();
      const n = sel?.anchorNode;
      const el = n instanceof Element ? n : n?.parentElement;
      const span = el?.closest("thead th .name") as HTMLElement | null;
      return span
        ? `off=${String(sel?.anchorOffset)}/${span.textContent?.length ?? 0}`
        : `outside:${n?.nodeName ?? "?"}`;
    });
    expect(caret).toBe("off=6/6"); // "region"
  });

  const rows = (page: Page) =>
    page.locator('#the-doc figure[data-table-id="regional-data"] tbody tr');

  test("a row Enter added and left blank goes away again", async ({ page }) => {
    await waitForDocument(page);
    const before = await rows(page).count();
    // Enter to confirm a value in the bottom row adds a row...
    await page.locator(td(2, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("333");
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(before + 1);
    // ...and Enter again in the blank new row adds no second one.
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(before + 1);
    // Clicking another cell of the same table takes the blank row
    // away, and that cell still takes the caret.
    await page.locator(td(0, 1)).click();
    await expect(rows(page)).toHaveCount(before);
    expect(await focusedCell(page)).toBe("0:1");
    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("333");
    expect(source).not.toMatch(/\[""(, "")*\]/);
  });

  test("a row Tab added keeps what is typed in it", async ({ page }) => {
    await waitForDocument(page);
    const before = await rows(page).count();
    await page.locator(td(2, 2)).click();
    await page.keyboard.press("Tab");
    await page.keyboard.type("West");
    // Leaving for the text keeps it: something was typed.
    await page.locator("#the-doc h1").first().click();
    await expect(rows(page)).toHaveCount(before + 1);
    await expect(page.locator(td(3, 0))).toHaveText("West");
    // A blank one left for the text goes.
    await page.locator(td(3, 2)).click();
    await page.keyboard.press("Tab");
    await expect(rows(page)).toHaveCount(before + 2);
    await page.locator("#the-doc h1").first().click();
    await expect(rows(page)).toHaveCount(before + 1);
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
  const codeBtn = "#btn-code";

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
    await insertFrom(page, "btn-code");
    const pre = page.locator("#the-doc pre.folio-code");
    await expect(pre).toBeVisible();
    await expect(pre.locator("code")).toContainText("Revenue recovered");
    await expect(page.locator(codeBtn)).toHaveClass(/active/);

    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain("```\n");

    await page.locator("#btn-view").click();
    await pre.click();
    await insertFrom(page, "btn-code");
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

test.describe("mermaid diagrams", () => {
  test("a mermaid directive renders an SVG diagram and round-trips", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill("# Flow\n\n::: mermaid {#flow}\ngraph TD\n  A --> B\n:::\n");
    await page.locator("#btn-view").click();

    const figure = page.locator("#the-doc figure.folio-diagram");
    await expect(figure).toBeVisible();
    await expect(figure.locator(".diagram-holder svg")).toBeVisible({
      timeout: 10_000,
    });
    await expect(figure).not.toContainText("Diagram error");

    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("::: mermaid {#flow}\ngraph TD\n  A --> B\n:::");
  });

  test("a broken diagram shows an error, not a crash", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill("::: mermaid {#bad}\nthis is not mermaid\n:::\n");
    await page.locator("#btn-view").click();

    const figure = page.locator("#the-doc figure.folio-diagram");
    await expect(figure).toContainText("Diagram error", { timeout: 10_000 });
  });
});

test.describe("insert group", () => {
  test("the diagram button inserts a Mermaid block in both views", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await insertFrom(page, "btn-diagram");
    const figure = page.locator("#the-doc figure.folio-diagram");
    await expect(figure).toBeVisible();
    await expect(figure.locator(".diagram-holder svg")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator("#status", { hasText: "Diagram inserted" }),
    ).toBeVisible();

    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("::: mermaid {#diagram-");

    // Markdown view: the button wraps the caret's line in a directive.
    await caretIn(page, "Revenue recovered", 3);
    await insertFrom(page, "btn-diagram");
    expect(await page.locator("#editor").inputValue()).toContain(
      "::: mermaid {#diagram-new}",
    );
  });

  test("the code button fences the caret's line in Markdown view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();

    await caretIn(page, "Revenue recovered", 3);
    await insertFrom(page, "btn-code");
    // The whole (blank-line delimited) paragraph is fenced.
    expect(await page.locator("#editor").inputValue()).toContain(
      "```\nRevenue recovered after the service outage, with the North region\nleading for the second consecutive quarter.\n```",
    );

    // Inside the fence the button lights up.
    await caretIn(page, "```\nRevenue recovered", 5);
    await expect(page.locator("#btn-code")).toHaveClass(/active/);
  });
});

async function selectWord(page: Page, word: string): Promise<void> {
  await page.evaluate((needle) => {
    const root = document.querySelector("folio-doc")?.shadowRoot as
      (ShadowRoot & { getSelection?: () => Selection }) | undefined;
    const p = root?.querySelector("p");
    if (!root || !p) return;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const idx = node.textContent?.indexOf(needle) ?? -1;
      if (idx >= 0) {
        root
          .getSelection?.()
          ?.setBaseAndExtent(node, idx, node, idx + needle.length);
        return;
      }
      node = walker.nextNode();
    }
  }, word);
}

test.describe("editor fixes", () => {
  test("Enter at the end of a paragraph appends a new block below it", async ({
    page,
  }) => {
    await waitForDocument(page);

    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("tail text");

    const order = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const ps = Array.from(root?.querySelectorAll("p") ?? []).map(
        (p) => p.textContent ?? "",
      );
      return ps.filter((t) => t.includes("Revenue") || t.includes("tail"));
    });
    expect(order[0]).toContain("Revenue recovered");
    expect(order[1]).toBe("tail text");
  });

  test("applying strikethrough/underline in document view renders and lights the buttons", async ({
    page,
  }) => {
    await waitForDocument(page);

    await selectWord(page, "Revenue");
    await page.locator('#fmt-bar button[data-cmd="strike"]').click();
    await expect(
      page.locator("folio-doc p del", { hasText: "Revenue" }),
    ).toBeVisible();
    await page.locator("folio-doc p del", { hasText: "Revenue" }).click();
    await expect(
      page.locator('#fmt-bar button[data-cmd="strike"]'),
    ).toHaveClass(/active/);

    await selectWord(page, "outage");
    await page.locator('#fmt-bar button[data-cmd="underline"]').click();
    await expect(
      page.locator("folio-doc p ins", { hasText: "outage" }),
    ).toBeVisible();
    await page.locator("folio-doc p ins", { hasText: "outage" }).click();
    await expect(
      page.locator('#fmt-bar button[data-cmd="underline"]'),
    ).toHaveClass(/active/);

    // And the semantics survive the round-trip.
    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toMatch(/~~Revenue~~/);
    expect(source).toMatch(/\+\+outage\+\+/);
  });

  test("a selected diagram is deleted with Backspace", async ({ page }) => {
    await waitForDocument(page);

    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await insertFrom(page, "btn-diagram");
    const figure = page.locator("#the-doc figure.folio-diagram");
    await expect(figure).toBeVisible();

    await figure.click();
    await page.keyboard.press("Backspace");
    await expect(figure).toHaveCount(0);
    const kinds = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => { blocks: { kind: string }[] };
        }
      )
        .getDoc()
        .blocks.map((b) => b.kind),
    );
    expect(kinds).not.toContain("diagram");
  });
});

async function caretInParagraph(
  page: Page,
  text: string,
  offset: number,
): Promise<void> {
  await page.evaluate(
    ({ needle, off }) => {
      const root = document.querySelector("folio-doc")?.shadowRoot as
        (ShadowRoot & { getSelection?: () => Selection }) | undefined;
      const ps = Array.from(root?.querySelectorAll("p") ?? []);
      const p = ps.find((el) => el.textContent?.includes(needle));
      if (!root || !p) return;
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const idx = node.textContent?.indexOf(needle) ?? -1;
        if (idx >= 0) {
          root
            .getSelection?.()
            ?.setBaseAndExtent(node, idx + off, node, idx + off);
          return;
        }
        node = walker.nextNode();
      }
    },
    { needle: text, off: offset },
  );
}

test.describe("native paragraph editing", () => {
  test("Enter mid-paragraph splits it and typing continues on the new line", async ({
    page,
  }) => {
    await waitForDocument(page);

    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    await page.keyboard.type("NEW LINE");

    const blocks = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => { blocks: { kind: string; text: string }[] };
        }
      )
        .getDoc()
        .blocks.map((b) => (b.kind === "prose" ? b.text.slice(0, 30) : b.kind)),
    );
    expect(
      blocks.some(
        (t) => typeof t === "string" && t.startsWith("Revenue recovered"),
      ),
    ).toBe(true);
    expect(
      blocks.some((t) => typeof t === "string" && t.includes("NEW LINE")),
    ).toBe(true);
  });

  test("Backspace at a block boundary merges paragraphs", async ({ page }) => {
    await waitForDocument(page);

    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace");
    const merged = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => { blocks: { kind: string; text: string }[] };
        }
      )
        .getDoc()
        .blocks.some(
          (b) =>
            b.kind === "prose" &&
            b.text.includes("Revenue recovered") &&
            b.text.includes("consecutive quarter"),
        ),
    );
    expect(merged).toBe(true);
  });

  test("typing around generated blocks preserves them", async ({ page }) => {
    await waitForDocument(page);

    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await page.keyboard.press("End");
    await page.keyboard.type(" (edited)");

    await expect(page.locator("#the-doc figure table").first()).toBeVisible();
    await expect(
      page.locator("#the-doc figure svg[role='img']").first(),
    ).toBeVisible();
    const source = await (async () => {
      await page.locator("#btn-markdown").click();
      return page.locator("#editor").inputValue();
    })();
    expect(source).toContain("::: table {#regional-data}");
    expect(source).toContain("::: chart {#growth-chart}");
    expect(source).toContain("(edited)");
  });
});
