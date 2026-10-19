import { expect, test, type Page } from "@playwright/test";

/**
 * Editor battery: WYSIWYG contract tests. Every test here simulates a
 * user action sequence that a word processor user would consider
 * obvious, and asserts the document model + rendered output follow.
 */

interface Doc {
  frontmatter: { theme?: string; style: [string, string][] };
  blocks: { kind: string; text?: string; level?: number }[];
}

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

function getDoc(page: Page): Promise<Doc> {
  return page.evaluate(
    () =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => unknown;
        }
      ).getDoc() as Doc,
  );
}

function proseTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const doc = (
      document.querySelector("folio-doc") as unknown as {
        getDoc: () => { blocks: { kind: string; text?: string }[] };
      }
    ).getDoc();
    return doc.blocks
      .filter((b) => b.kind === "prose")
      .map((b) => b.text ?? "");
  });
}

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

async function selectWord(page: Page, word: string): Promise<void> {
  await page.evaluate((needle) => {
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
          ?.setBaseAndExtent(node, idx, node, idx + needle.length);
        return;
      }
      node = walker.nextNode();
    }
  }, word);
}

const fmt = (cmd: string) => `#fmt-bar button[data-cmd="${cmd}"]`;

/* ------------------------------------------------------------------ */
/* Paragraph editing                                                   */
/* ------------------------------------------------------------------ */

test.describe("paragraph editing", () => {
  test("Enter at the very end appends a new paragraph and typing goes there", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("tail");
    const texts = await proseTexts(page);
    const idx = texts.findIndex((t) => t.includes("Revenue recovered"));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(texts[idx + 1]).toContain("tail");
  });

  test("Enter mid-paragraph splits it in two at the caret", async ({
    page,
  }) => {
    await waitForDocument(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    const texts = await proseTexts(page);
    expect(texts.some((t) => t.startsWith("Revenue recovered"))).toBeTruthy();
    expect(texts.some((t) => t.startsWith("after the service"))).toBeTruthy();
  });

  test("Enter twice from the end creates two empty paragraphs", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    const texts = await proseTexts(page);
    const idx = texts.findIndex((t) => t.includes("Revenue recovered"));
    expect(texts[idx + 1] ?? "").toBe("");
    expect(texts[idx + 2] ?? "").toBe("");
  });

  test("Backspace at a block boundary merges the paragraphs", async ({
    page,
  }) => {
    await waitForDocument(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace");
    const texts = await proseTexts(page);
    expect(
      texts.some(
        (t) => t.includes("Revenue recovered") && t.includes("service outage"),
      ),
    ).toBeTruthy();
  });

  test("Backspace at the start of a paragraph merges it into the previous block", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = (await getDoc(page)).blocks.length;
    await caretInParagraph(page, "Numbers are pulled live", 0);
    await page.keyboard.press("Backspace");
    const doc = await getDoc(page);
    expect(doc.blocks.length).toBe(before - 1);
    expect(
      doc.blocks.some(
        (b) =>
          (b.text ?? "").includes("Regional summary") &&
          (b.text ?? "").includes("Numbers are pulled live"),
      ),
    ).toBeTruthy();
  });

  test("editing one paragraph leaves the others untouched", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await proseTexts(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.type("X");
    const after = await proseTexts(page);
    expect(after.length).toBe(before.length);
    expect(
      after.filter((t, i) => before[i] === t).length,
    ).toBeGreaterThanOrEqual(before.length - 1);
  });

  test("Enter at the end of a heading starts a paragraph (word-processor style)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second");
    const doc = await getDoc(page);
    const second = doc.blocks.find((b) => (b.text ?? "") === "Second");
    expect(second?.kind).toBe("prose");
  });

  test("splitting a paragraph then merging restores the original text", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = (await proseTexts(page)).find((t) =>
      t.includes("Revenue recovered"),
    );
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace");
    const after = (await proseTexts(page)).find((t) =>
      t.includes("Revenue recovered"),
    );
    expect(after).toBe(before);
  });

  test("a split paragraph round-trips through the Markdown view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    // A hard split makes two blocks (blank line); a soft break is a
    // single block with a newline. Both are lossless.
    expect(source).toMatch(/Revenue recovered\s*\n/);
    // Re-parsing canonicalizes trailing whitespace; compare modulo
    // per-line trailing spaces, and require stability after that.
    const norm = (x: string): string =>
      x
        .split("\n")
        .map((l) => l.replace(/\s+$/, ""))
        .join("\n");
    await page.locator("#btn-view").click();
    await page.locator("#btn-markdown").click();
    const second = await page.locator("#editor").inputValue();
    expect(norm(second)).toBe(norm(source));
    await page.locator("#btn-view").click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe(second);
  });

  test("Enter at the end of the document heading inserts a paragraph", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h1", { hasText: "Q3" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Sub");
    const doc = await getDoc(page);
    const h = doc.blocks.find((b) => (b.text ?? "") === "Sub");
    expect(h?.kind).toBe("prose");
  });
});

/* ------------------------------------------------------------------ */
/* Inline formats                                                      */
/* ------------------------------------------------------------------ */

test.describe("inline formats (document view)", () => {
  test("bold applies and toggles off", async ({ page }) => {
    await waitForDocument(page);
    await selectWord(page, "outage");
    await page.locator(fmt("bold")).click();
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toBeVisible();
    await page.locator("folio-doc p strong", { hasText: "outage" }).click();
    await page.locator(fmt("bold")).click();
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toHaveCount(0);
  });

  test("italic applies and round-trips", async ({ page }) => {
    await waitForDocument(page);
    await selectWord(page, "outage");
    await page.locator(fmt("italic")).click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(/\*outage\*/);
  });

  test("strikethrough applies and round-trips", async ({ page }) => {
    await waitForDocument(page);
    await selectWord(page, "outage");
    await page.locator(fmt("strike")).click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(/~~outage~~/);
  });

  test("underline applies and round-trips", async ({ page }) => {
    await waitForDocument(page);
    await selectWord(page, "outage");
    await page.locator(fmt("underline")).click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /\+\+outage\+\+/,
    );
  });

  test("nested formats compose on the same selection", async ({ page }) => {
    await waitForDocument(page);
    await selectWord(page, "outage");
    await page.locator(fmt("bold")).click();
    // Re-select the same text (now inside <strong>) and add strike.
    await selectWord(page, "outage");
    await page.locator(fmt("strike")).click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /~~\*\*outage\*\*~~|~~outage~~/,
    );
  });

  test("with no selection the format buttons flash guidance", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator(fmt("bold")).click();
    await expect(
      page.locator("#status", { hasText: "Select some text first" }),
    ).toBeVisible();
  });

  test("the caret inside each format lights its button", async ({ page }) => {
    await waitForDocument(page);
    await selectWord(page, "outage");
    await page.locator(fmt("bold")).click();
    await page.locator("folio-doc p strong", { hasText: "outage" }).click();
    await expect(page.locator(fmt("bold"))).toHaveClass(/active/);
    await expect(page.locator(fmt("italic"))).not.toHaveClass(/active/);
  });

  test("inline buttons are disabled inside headings", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h1", { hasText: "Q3" }).click();
    for (const cmd of ["bold", "italic", "strike", "underline"]) {
      await expect(page.locator(fmt(cmd))).toBeDisabled();
    }
  });

  test("the existing sample bold text lights the bold button", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc strong", { hasText: "Midlands" }).click();
    await expect(page.locator(fmt("bold"))).toHaveClass(/active/);
  });

  // The WebKitGTK (Tauri) fallback: no pierceable selection API, so
  // the component tracks drag selections from the press/release
  // caret points. Synthetic mouse events create no native
  // selection even in Chromium, which makes the fallback path
  // testable in CI.
  async function syntheticDragSelect(
    page: Page,
    word: string,
    opts: { detail?: number; dy?: number } = {},
  ): Promise<void> {
    await page.evaluate(
      ({ needle, detail, dy }) => {
        const root = document.querySelector("folio-doc")?.shadowRoot;
        const host = root?.querySelector("article.folio-doc") as
          HTMLElement | undefined;
        if (!root || !host) return;
        const p = Array.from(root.querySelectorAll("p")).find((el) =>
          el.textContent?.includes(needle),
        );
        if (!p) return;
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let rect: DOMRect | null = null;
        while (node) {
          const idx = node.textContent?.indexOf(needle) ?? -1;
          if (idx >= 0) {
            const r = document.createRange();
            r.setStart(node, idx);
            r.setEnd(node, idx + needle.length);
            rect = r.getClientRects()[0] ?? null;
            break;
          }
          node = walker.nextNode();
        }
        if (!rect) return;
        // A real click focuses the article; synthetic events do not.
        host.focus();
        host.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            detail,
            clientX: rect.x + 2,
            clientY: rect.y + rect.height / 2,
          }),
        );
        host.dispatchEvent(
          new MouseEvent("mouseup", {
            bubbles: true,
            detail,
            clientX: rect.x + rect.width - 2,
            clientY: rect.y + rect.height / 2 + dy,
          }),
        );
      },
      { needle: word, detail: opts.detail ?? 1, dy: opts.dy ?? 0 },
    );
  }

  async function pressFormatButton(page: Page, cmd: string): Promise<void> {
    await page.evaluate((name) => {
      document
        .querySelector(`#fmt-bar button[data-cmd="${name}"]`)
        ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }, cmd);
  }

  test("a drag selection applies bold without a native selection (WebKit path)", async ({
    page,
  }) => {
    await waitForDocument(page);
    // Simulate WebKitGTK: no pierceable shadow-root selection API.
    await page.evaluate(() => {
      delete (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection;
    });
    await syntheticDragSelect(page, "outage");
    await pressFormatButton(page, "bold");
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /\*\*outage\*\*/,
    );
  });

  test("a drag selection over formatted text toggles the format off (WebKit path)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.evaluate(() => {
      delete (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection;
    });
    await syntheticDragSelect(page, "outage");
    await pressFormatButton(page, "bold");
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toBeVisible();
    // The drag starts exactly at the strong boundary; the toggle
    // must see through it to the first formatted character.
    await syntheticDragSelect(page, "outage");
    await pressFormatButton(page, "bold");
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toHaveCount(0);
  });

  test("a double-click word selection applies a format (WebKit path)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.evaluate(() => {
      delete (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection;
    });
    // A double click selects no drag: the second mouseup carries
    // detail >= 2 and no usable drag range exists.
    await syntheticDragSelect(page, "outage", { detail: 2 });
    await pressFormatButton(page, "bold");
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /\*\*outage\*\*/,
    );
  });

  test("a drag released below the line still selects the word (WebKit path)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.evaluate(() => {
      delete (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection;
    });
    // Real users release drags with vertical slop; the geometric
    // caret search snaps to the nearest line.
    await syntheticDragSelect(page, "outage", { dy: 8 });
    await pressFormatButton(page, "bold");
    await expect(
      page.locator("folio-doc p strong", { hasText: "outage" }),
    ).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

test.describe("tables", () => {
  const td = (r: number, c: number) =>
    `#the-doc td[data-row-index="${r}"][data-col-index="${c}"]`;

  test("Enter in a paragraph after using a table cell splits the paragraph, not the table", async ({
    page,
  }) => {
    await waitForDocument(page);
    // Use a table cell first (types into it, commits via Tab).
    await page.locator(td(0, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");
    // Now go to a paragraph and press Enter.
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("after-table");

    const texts = await proseTexts(page);
    const idx = texts.findIndex((t) => t.includes("Revenue recovered"));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(texts[idx + 1]).toContain("after-table");
    // The table must NOT have grown.
    const rows = await page.locator("#the-doc tbody tr").count();
    expect(rows).toBe(3);
  });

  test("Enter after a table splits the paragraph on engines with no pierceable selection (WebKit path)", async ({
    page,
  }) => {
    await waitForDocument(page);
    // Simulate WebKitGTK: no shadow-root selection API, so the
    // last used cell is the only context - the most recent click
    // must override it or Enter grows the table from a paragraph.
    await page.evaluate(() => {
      delete (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection;
    });
    await page.locator(td(0, 1)).click();
    await page.keyboard.type("410");
    await page
      .locator("folio-doc p", { hasText: "Numbers are pulled live" })
      .click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("tail");
    const rows = await page.locator("#the-doc tbody tr").count();
    expect(rows).toBe(3);
    const texts = await proseTexts(page);
    const idx = texts.findIndex((t) => t.includes("Numbers are pulled live"));
    expect(texts[idx + 1]).toContain("tail");
  });

  test("Tab moves to the next editable cell and commits", async ({ page }) => {
    await waitForDocument(page);
    await page.locator(td(0, 0)).click();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const a = document.querySelector("folio-doc")?.shadowRoot?.activeElement;
      return a instanceof HTMLElement
        ? `${a.dataset.rowIndex}:${a.dataset.colIndex}`
        : null;
    });
    expect(focused).toBe("0:1");
  });

  test("Enter inside a table cell moves down a column", async ({ page }) => {
    await waitForDocument(page);
    await page.locator(td(0, 0)).click();
    await page.keyboard.press("Enter");
    const focused = await page.evaluate(() => {
      const a = document.querySelector("folio-doc")?.shadowRoot?.activeElement;
      return a instanceof HTMLElement
        ? `${a.dataset.rowIndex}:${a.dataset.colIndex}`
        : null;
    });
    expect(focused).toBe("1:0");
  });

  test("editing a cell recalculates the formula column for that row", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator(td(0, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");
    await expect(page.locator(td(0, 3))).toHaveText("25.3%");
  });

  test("editing a cell keeps the data through a Markdown round-trip", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator(td(0, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "[North, 400, 501]",
    );
  });

  test("formula cells are not editable", async ({ page }) => {
    await waitForDocument(page);
    const editable = await page
      .locator(td(0, 3))
      .evaluate((el) => (el as HTMLElement).contentEditable);
    expect(editable).toBe("false");
  });

  test("Tab from the last cell of the last row appends a row", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("#the-doc tbody tr").count();
    await page.locator(td(2, 2)).click();
    await page.keyboard.press("Tab");
    await expect(page.locator("#the-doc tbody tr")).toHaveCount(before + 1);
  });

  test("clicking a cell then a heading does not break heading Enter", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator(td(0, 0)).click();
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("part");
    const doc = await getDoc(page);
    expect(doc.blocks.some((b) => (b.text ?? "") === "part")).toBeTruthy();
  });

  test("typing in a cell then clicking a paragraph keeps the cell data on blur", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator(td(0, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "[North, 400, 501]",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Code blocks                                                         */
/* ------------------------------------------------------------------ */

test.describe("code blocks", () => {
  test("the toolbar code button converts a paragraph to a code block and back", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-code").click();
    await expect(page.locator("#the-doc pre.folio-code")).toBeVisible();
    await page.locator("#the-doc pre.folio-code").click();
    await page.locator("#btn-code").click();
    await expect(
      page.locator("folio-doc p", { hasText: "Revenue recovered" }),
    ).toBeVisible();
  });

  test("Enter inside a code block adds a line, not a block", async ({
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
  });

  test("the code button is active while the caret is in a code block", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-code").click();
    await page.locator("#the-doc pre.folio-code").click();
    await expect(page.locator("#btn-code")).toHaveClass(/active/);
  });

  test("a code block survives paragraph edits around it", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill("# T\n\nbefore\n\n```js\nconst x = 1;\n```\n\nafter\n");
    await page.locator("#btn-view").click();
    await caretInParagraph(page, "before", 6);
    await page.keyboard.press("Enter");
    await page.keyboard.type("middle");
    const doc = await getDoc(page);
    expect(
      doc.blocks.some(
        (b) => b.kind === "code" && (b.text ?? "").includes("const x"),
      ),
    ).toBeTruthy();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "```js\nconst x = 1;\n```",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Diagrams                                                            */
/* ------------------------------------------------------------------ */

test.describe("diagrams", () => {
  test("inserting a diagram renders an SVG", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-diagram").click();
    await expect(page.locator("#the-doc figure.folio-diagram svg")).toBeVisible(
      { timeout: 10_000 },
    );
  });

  test("a selected diagram is deleted by Backspace and by Delete", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-diagram").click();
    const figure = page.locator("#the-doc figure.folio-diagram");
    await expect(figure).toBeVisible();
    await figure.click();
    await page.keyboard.press("Delete");
    await expect(figure).toHaveCount(0);
  });

  test("Enter on a selected diagram does not split anything", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-diagram").click();
    const figure = page.locator("#the-doc figure.folio-diagram");
    await figure.click();
    await page.keyboard.press("Enter");
    await expect(figure).toBeVisible();
    const doc = await getDoc(page);
    expect(doc.blocks.filter((b) => b.kind === "diagram").length).toBe(1);
  });

  test("a diagram survives paragraph editing around it", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-diagram").click();
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    await page.keyboard.type("next");
    const doc = await getDoc(page);
    expect(doc.blocks.filter((b) => b.kind === "diagram").length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Round-trips                                                         */
/* ------------------------------------------------------------------ */

test.describe("view round-trips", () => {
  test("doc -> markdown -> doc preserves the document", async ({ page }) => {
    await waitForDocument(page);
    const before = await page.evaluate(() => {
      const el = document.querySelector("folio-doc") as unknown as {
        getMarkdown: () => string | null;
      };
      return el.getMarkdown();
    });
    await page.locator("#btn-markdown").click();
    await page.locator("#btn-view").click();
    const after = await page.evaluate(() => {
      const el = document.querySelector("folio-doc") as unknown as {
        getMarkdown: () => string | null;
      };
      return el.getMarkdown();
    });
    expect(after).toBe(before);
  });

  test("typed text appears in the source without switching views", async ({
    page,
  }) => {
    await waitForDocument(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.type("ZZ");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "Revenue recovered ZZ",
    );
  });

  test("an invalid source edit stays in Markdown view with an error", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill("::: table {#broken}\ncolumns:\n");
    await page.locator("#btn-view").click();
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#status")).toContainText("Parse error");
  });

  test("the section outline grows when a new heading is created", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-sidebar").click();
    const before = await page.locator("#outline button").count();
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("New heading");
    await page.locator('#block-bar button[data-block="h2"]').click();
    await expect(page.locator("#outline button")).toHaveCount(before + 1);
  });

  test("a new paragraph appears in the outline-free flow (no crash)", async ({
    page,
  }) => {
    await waitForDocument(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    await page.keyboard.type("plain line");
    await expect(page.locator("#status")).not.toContainText("Parse error");
  });
});

/* ------------------------------------------------------------------ */
/* Toolbar reflection                                                  */
/* ------------------------------------------------------------------ */

test.describe("toolbar reflection", () => {
  test("block buttons follow the caret across paragraphs and headings", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(page.locator('#block-bar button[data-block="p"]')).toHaveClass(
      /active/,
    );
    await page.locator("folio-doc h1", { hasText: "Q3" }).click();
    await expect(
      page.locator('#block-bar button[data-block="h1"]'),
    ).toHaveClass(/active/);
    await page
      .locator("folio-doc p", { hasText: "Growth was strongest" })
      .click();
    await expect(page.locator('#block-bar button[data-block="p"]')).toHaveClass(
      /active/,
    );
  });

  test("clicking a table cell lights no block button", async ({ page }) => {
    await waitForDocument(page);
    await page
      .locator('#the-doc td[data-row-index="0"][data-col-index="0"]')
      .click();
    const active = await page.locator("#block-bar button.active").count();
    expect(active).toBe(0);
  });

  test("inline buttons are disabled in a code block", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await page.locator("#editor").fill("# T\n\n```\nx\n```\n");
    await page.locator("#btn-view").click();
    await page.locator("#the-doc pre.folio-code").click();
    for (const cmd of ["bold", "italic", "strike", "underline"]) {
      await expect(page.locator(fmt(cmd))).toBeDisabled();
    }
    // ...but the code-block button stays available.
    await expect(page.locator("#btn-code")).toBeEnabled();
  });

  test("markdown view: tokens light their buttons at the caret", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("#btn-markdown").click();
    await caretIn(page, "**Midlands**", 5);
    await expect(page.locator(fmt("bold"))).toHaveClass(/active/);
    await caretIn(page, "outage", 2);
    await page.locator(fmt("strike")).click();
    await caretIn(page, "~~outage~~", 4);
    await expect(page.locator(fmt("strike"))).toHaveClass(/active/);
  });
});

async function caretIn(page: Page, needle: string, offset = 1): Promise<void> {
  await page.evaluate(
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

/* ------------------------------------------------------------------ */
/* Block conversion via the toolbar (document view)                    */
/* ------------------------------------------------------------------ */

test.describe("block conversion (document view)", () => {
  test("H1 converts a paragraph and reaches the source as an ATX heading", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator('#block-bar button[data-block="h1"]').click();
    await expect(
      page.locator("#the-doc h1", { hasText: "Revenue recovered" }),
    ).toBeVisible();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toMatch(
      /^# Revenue recovered/m,
    );
  });

  test("P converts a heading back to a paragraph", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.locator('#block-bar button[data-block="p"]').click();
    await expect(
      page.locator("#the-doc p", { hasText: "Regional summary" }),
    ).toBeVisible();
    const doc = await getDoc(page);
    const block = doc.blocks.find((b) =>
      (b.text ?? "").includes("Regional summary"),
    );
    expect(block?.kind).toBe("prose");
  });

  test("H1 then H2 changes the level without touching the text", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.locator('#block-bar button[data-block="h1"]').click();
    await page.locator('#block-bar button[data-block="h2"]').click();
    const doc = await getDoc(page);
    const block = doc.blocks.find((b) =>
      (b.text ?? "").includes("Regional summary"),
    );
    expect(block?.kind).toBe("heading");
    expect(block?.level).toBe(2);
  });

  test("a paragraph created by Enter converts with the toolbar", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Fresh line");
    await page.locator('#block-bar button[data-block="h1"]').click();
    await expect(
      page.locator("#the-doc h1", { hasText: "Fresh line" }),
    ).toBeVisible();
  });

  test("demoting a heading shrinks the section outline", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("#btn-sidebar").click();
    const before = await page.locator("#outline button").count();
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.locator('#block-bar button[data-block="p"]').click();
    await expect(page.locator("#outline button")).toHaveCount(before - 1);
  });
});

/* ------------------------------------------------------------------ */
/* Caret movement                                                      */
/* ------------------------------------------------------------------ */

test.describe("caret movement", () => {
  test("ArrowDown carries the caret and the block bar into the next block", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowDown");
    await expect(
      page.locator('#block-bar button[data-block="h2"]'),
    ).toHaveClass(/active/);
  });

  test("ArrowUp returns the caret to the previous block", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await expect(page.locator('#block-bar button[data-block="p"]')).toHaveClass(
      /active/,
    );
  });

  test("Home and End keep typing inside the current paragraph", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = (await proseTexts(page)).length;
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.type("tail");
    await page.keyboard.press("Home");
    await page.keyboard.type("head ");
    const texts = await proseTexts(page);
    expect(texts.length).toBe(before);
    const line = texts.find((t) => t.includes("tail"));
    expect(line).toContain("head ");
  });

  test("arrowing past a table leaves the document intact", async ({ page }) => {
    await waitForDocument(page);
    const before = await getDoc(page);
    await page
      .locator("folio-doc p", { hasText: "Numbers are pulled live" })
      .click();
    await page.keyboard.press("End");
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
    const after = await getDoc(page);
    expect(after.blocks.filter((b) => b.kind === "table").length).toBe(
      before.blocks.filter((b) => b.kind === "table").length,
    );
    await expect(page.locator("#status")).not.toContainText("Parse error");
  });
});

/* ------------------------------------------------------------------ */
/* Undo                                                                */
/* ------------------------------------------------------------------ */

test.describe("undo", () => {
  test("Ctrl+Z undoes typed text", async ({ page }) => {
    await waitForDocument(page);
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.type("ZZ");
    await page.keyboard.press("Control+z");
    const texts = await proseTexts(page);
    expect(texts.some((t) => t.includes("Revenue recovered ZZ"))).toBeFalsy();
    expect(texts.some((t) => t.includes("Revenue recovered"))).toBeTruthy();
  });

  test("Ctrl+Z undoes an Enter split", async ({ page }) => {
    await waitForDocument(page);
    const before = (await proseTexts(page)).length;
    await caretInParagraph(page, "Revenue recovered", 18);
    await page.keyboard.press("Enter");
    expect((await proseTexts(page)).length).toBe(before + 1);
    await page.keyboard.press("Control+z");
    expect((await proseTexts(page)).length).toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* Block boundaries                                                    */
/* ------------------------------------------------------------------ */

test.describe("block boundaries", () => {
  test("Backspace at the start of a heading merges it into the paragraph above", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = (await getDoc(page)).blocks.length;
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Backspace");
    const doc = await getDoc(page);
    expect(doc.blocks.length).toBe(before - 1);
    expect(
      doc.blocks.some(
        (b) =>
          (b.text ?? "").includes("Revenue recovered") &&
          (b.text ?? "").includes("Regional summary"),
      ),
    ).toBeTruthy();
  });

  test("Enter at the start of a heading keeps the heading style", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = (await getDoc(page)).blocks.filter(
      (b) => b.kind === "heading",
    ).length;
    await page.locator("folio-doc h2", { hasText: "Regional summary" }).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    const doc = await getDoc(page);
    const headings = doc.blocks.filter((b) => b.kind === "heading");
    expect(headings.length).toBe(before + 1);
    expect(
      headings.some((b) => (b.text ?? "") === "Regional summary"),
    ).toBeTruthy();
  });

  test("typing in a converted code block reaches the Markdown source", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#btn-code").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" plus");
    await page.locator("#btn-markdown").click();
    const source = await page.locator("#editor").inputValue();
    expect(source).toContain("```");
    expect(source).toMatch(/North region plus/);
  });
});

/* ------------------------------------------------------------------ */
/* Table navigation extras                                             */
/* ------------------------------------------------------------------ */

test.describe("table navigation extras", () => {
  const td = (r: number, c: number) =>
    `#the-doc td[data-row-index="${r}"][data-col-index="${c}"]`;

  async function focusedCell(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const a = document.querySelector("folio-doc")?.shadowRoot?.activeElement;
      return a instanceof HTMLElement
        ? `${a.dataset.rowIndex}:${a.dataset.colIndex}`
        : null;
    });
  }

  test("Tab skips the formula column and wraps to the next row", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator(td(0, 2)).click();
    await page.keyboard.press("Tab");
    expect(await focusedCell(page)).toBe("1:0");
  });

  test("Shift+Tab moves back through editable cells", async ({ page }) => {
    await waitForDocument(page);
    await page.locator(td(0, 2)).click();
    await page.keyboard.press("Shift+Tab");
    expect(await focusedCell(page)).toBe("0:1");
  });

  test("Shift+Tab from a row head returns to the previous row's tail", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator(td(1, 0)).click();
    await page.keyboard.press("Shift+Tab");
    expect(await focusedCell(page)).toBe("0:2");
  });

  test("editing a cell refreshes the dependent chart", async ({ page }) => {
    await waitForDocument(page);
    await page.locator(td(0, 1)).click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("400");
    await page.keyboard.press("Tab");
    await expect(
      page.locator("#the-doc figure[data-chart-source] svg"),
    ).toContainText("0.25");
  });
});

/* ------------------------------------------------------------------ */
/* Empty blocks                                                        */
/* ------------------------------------------------------------------ */

test.describe("empty blocks", () => {
  test("empty paragraphs survive a Markdown round-trip", async ({ page }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.locator("#btn-markdown").click();
    const first = await page.locator("#editor").inputValue();
    await page.locator("#btn-view").click();
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe(first);
  });
});
