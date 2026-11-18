import { expect, test, type Page } from "@playwright/test";

/**
 * Bundled proofing (spec: docs/specs/spellcheck-grammar.md, ADR-0033):
 * spell check via nspell + the vendored en_US dictionary is ON by
 * default and owns the squiggles (the article's native spellcheck is
 * off); grammar via harper.js is opt-in through the palette. Marks are
 * view-layer spans - the model never contains them - and right-clicking
 * a mark opens a menu with working suggestions.
 */

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
  await page.locator("#the-doc h1").first().waitFor();
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

const SPELL_DOC = `# Proofing\n\nThis wordd is misspelled and teh end.`;

const misspelled = (page: Page) =>
  page.locator("#the-doc span.folio-misspelled");
const proofMenu = (page: Page) =>
  page.locator("#the-doc .folio-menu.folio-proof-menu");

test.describe("bundled spell check", () => {
  test("misspellings get squiggle marks; the model stays clean; right-click offers working suggestions and add-to-dictionary", async ({
    page,
  }) => {
    await loadDoc(page, SPELL_DOC);

    // both words are wrapped; the marks are spans, not model content
    await expect(misspelled(page)).toHaveCount(2, { timeout: 15_000 });
    await expect(misspelled(page).first()).toHaveText(/wordd|teh/);
    expect(await proseTexts(page)).toEqual([
      "This wordd is misspelled and teh end.",
    ]);

    // right-click the "wordd" mark -> suggestions menu
    await misspelled(page).filter({ hasText: "wordd" }).click({
      button: "right",
    });
    await expect(proofMenu(page)).toBeVisible();
    await expect(proofMenu(page)).toHaveAttribute("aria-label", "Spelling");
    const wordFix = proofMenu(page)
      .locator("button", { hasText: /^word$/ })
      .first();
    await expect(wordFix).toBeVisible();
    await wordFix.click();
    await expect(proofMenu(page)).toBeHidden();
    // the fix landed in the rendered prose AND the model
    await expect(page.locator("#the-doc p")).toHaveText(
      "This word is misspelled and teh end.",
    );
    expect(await proseTexts(page)).toEqual([
      "This word is misspelled and teh end.",
    ]);
    // only "teh" is still marked
    await expect(misspelled(page)).toHaveCount(1);

    // right-click "teh" -> add to dictionary persists and clears the mark
    await misspelled(page).click({ button: "right" });
    await expect(proofMenu(page)).toBeVisible();
    await proofMenu(page)
      .locator("button", { hasText: "to dictionary" })
      .click();
    await expect(misspelled(page)).toHaveCount(0);
    const custom = await page.evaluate(() =>
      localStorage.getItem("folio.spellcheck.custom.v1"),
    );
    expect(JSON.parse(custom ?? "[]")).toContain("teh");
    // the word itself is untouched
    expect(await proseTexts(page)).toEqual([
      "This word is misspelled and teh end.",
    ]);
  });

  test('spellcheck="false" clears the marks; removing it brings them back', async ({
    page,
  }) => {
    await loadDoc(page, SPELL_DOC);
    await expect(misspelled(page)).toHaveCount(2, { timeout: 15_000 });
    await page.evaluate(() =>
      document.querySelector("folio-doc")?.setAttribute("spellcheck", "false"),
    );
    await expect(misspelled(page)).toHaveCount(0);
    await page.evaluate(() =>
      document.querySelector("folio-doc")?.removeAttribute("spellcheck"),
    );
    await expect(misspelled(page)).toHaveCount(2, { timeout: 15_000 });
  });

  test("marks work inside table cells; right-clicking one keeps the table menu and prepends the spelling group", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `# Proofing\n\n::: table {#t}\ncaption: "T"\ncolumns:\n  - {name: note, type: text}\ndata:\n  - [wordd here]\n:::`,
    );
    const cellMark = page.locator("#the-doc td span.folio-misspelled");
    await expect(cellMark).toHaveCount(1, { timeout: 15_000 });
    await expect(cellMark).toHaveText("wordd");
    // dispatch on the exact mark: the bar-reveal scroll shifts what a
    // real right-click lands on (same gotcha as table-context-menu)
    const box = await cellMark.boundingBox();
    await cellMark.dispatchEvent("contextmenu", {
      button: 2,
      clientX: box ? box.x + box.width / 2 : 100,
      clientY: box ? box.y + box.height / 2 : 100,
    });
    // the table menu owns the right-click in a cell; the spelling
    // suggestions ride at its top, the table actions stay below
    const tableMenu = page.locator("#the-doc .folio-menu.folio-table-menu");
    await expect(tableMenu).toBeVisible();
    const firstItem = tableMenu.locator("button").first();
    await expect(firstItem).toHaveText(/^word/);
    await expect(
      tableMenu.locator("button", { hasText: "to dictionary" }),
    ).toBeVisible();
    await expect(
      tableMenu.locator("button", { hasText: "Insert column right" }),
    ).toBeVisible();
    // a suggestion fixes the cell and re-syncs the model
    await tableMenu
      .locator("button", { hasText: /^word$/ })
      .first()
      .click();
    await expect(tableMenu).toBeHidden();
    await expect(page.locator("#the-doc td")).toHaveText("word here");
    await expect(cellMark).toHaveCount(0);
    const doc = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => {
            blocks: { kind: string; table?: { rows: unknown[][] } }[];
          };
        }
      ).getDoc(),
    );
    const table = doc.blocks.find((b) => b.kind === "table");
    expect(table?.table?.rows).toEqual([["word here"]]);
  });
});

test.describe("markdown source view", () => {
  // the bundled checker also marks the highlight overlay in the source
  // view (prose tokens only); the textarea's value never holds marks
  const srcMarks = (page: Page) => page.locator("#md-view .folio-misspelled");
  const srcMenu = (page: Page) => page.locator(".proof-menu");

  async function rightClickWord(page: Page, needle: string): Promise<void> {
    await page.locator("#editor").evaluate((el, n) => {
      const ta = el as HTMLTextAreaElement;
      const v = ta.value;
      const i = v.indexOf(n);
      if (i < 0) throw new Error(`no ${n} in source`);
      ta.focus();
      ta.setSelectionRange(
        i + Math.min(2, n.length),
        i + Math.min(2, n.length),
      );
      ta.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 200,
        }),
      );
    }, needle);
  }

  test("misspellings are marked in the overlay, the source stays clean, right-click applies a suggestion", async ({
    page,
  }) => {
    await loadDoc(page, SPELL_DOC);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-wrap")).toBeVisible();

    await expect(srcMarks(page)).toHaveCount(2, { timeout: 15_000 });
    await expect(srcMarks(page).first()).toHaveText(/wordd|teh/);
    // the textarea (the model) is untouched - marks live in the overlay
    expect(await page.locator("#editor").inputValue()).toContain("wordd");
    expect(await page.locator("#editor").inputValue()).toContain("teh");

    await rightClickWord(page, "wordd");
    await expect(srcMenu(page)).toBeVisible();
    await expect(srcMenu(page)).toHaveAttribute("aria-label", "Spelling");
    await srcMenu(page)
      .locator("button", { hasText: /^word$/ })
      .first()
      .click();
    await expect(srcMenu(page)).toBeHidden();
    // the fix landed in the source; the mark count dropped
    expect(await page.locator("#editor").inputValue()).toContain(
      "This word is misspelled",
    );
    await expect(srcMarks(page)).toHaveCount(1);

    // switching back parses the fix into the document view and the model
    await page.locator("#btn-view").click();
    await expect(page.locator("#the-doc p")).toHaveText(
      "This word is misspelled and teh end.",
    );
    expect(await proseTexts(page)).toEqual([
      "This word is misspelled and teh end.",
    ]);
  });

  test('spellcheck="false" clears the source-view marks too', async ({
    page,
  }) => {
    await loadDoc(page, SPELL_DOC);
    await page.locator("#btn-markdown").click();
    await expect(srcMarks(page)).toHaveCount(2, { timeout: 15_000 });
    await page.evaluate(() =>
      document.querySelector("folio-doc")?.setAttribute("spellcheck", "false"),
    );
    await expect(srcMarks(page)).toHaveCount(0);
    await page.evaluate(() =>
      document.querySelector("folio-doc")?.removeAttribute("spellcheck"),
    );
    await expect(srcMarks(page)).toHaveCount(2, { timeout: 15_000 });
  });

  test("code, fences and ::: blocks are never marked in the source view", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `# Proofing\n\nwordd in prose, but \`codee\` and\n\n\`\`\`\nfencedd codee\n\`\`\`\n\n::: table {#t}\ncaption: "T"\ncolumns:\n  - {name: note, type: text}\ndata:\n  - [celll]\n:::`,
    );
    await page.locator("#btn-markdown").click();
    await expect(srcMarks(page)).toHaveCount(1, { timeout: 15_000 });
    await expect(srcMarks(page).first()).toHaveText("wordd");
  });
});

test.describe("bundled grammar check (Harper, opt-in)", () => {
  // the wasm engine (~20 MB) loads once from the app's own assets
  test.describe.configure({ timeout: 120_000 });
  test("palette command enables it; repeated word gets a grammar mark; right-click applies a suggestion", async ({
    page,
  }) => {
    await loadDoc(page, `# Proofing\n\nI saw the the dog.`);
    // no grammar marks before opting in
    await expect(page.locator("#the-doc span.folio-grammar")).toHaveCount(0);

    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("grammar");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Check grammar with Harper");
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-modal")).toBeHidden();
    expect(
      await page.evaluate(() => localStorage.getItem("folio.grammar.v1")),
    ).toBe("1");

    // the wasm loads once (~20 MB from the app's own assets), then lints
    const grammar = page.locator("#the-doc span.folio-grammar");
    await expect(grammar).toHaveCount(1, { timeout: 90_000 });
    await expect(grammar).toHaveText("the the");
    // still not in the model
    expect(await proseTexts(page)).toEqual(["I saw the the dog."]);

    await grammar.click({ button: "right" });
    await expect(proofMenu(page)).toBeVisible();
    await expect(proofMenu(page)).toHaveAttribute("aria-label", "Grammar");
    await proofMenu(page).locator("button").first().click();
    await expect(proofMenu(page)).toBeHidden();
    await expect(page.locator("#the-doc p")).toHaveText("I saw the dog.");
    expect(await proseTexts(page)).toEqual(["I saw the dog."]);
    await expect(page.locator("#the-doc span.folio-grammar")).toHaveCount(0);
  });

  test("a grammar mark survives a later mark pass (unwrap splits the text node; the re-wrap must not lose it)", async ({
    page,
  }) => {
    // Regression: unwrapping a mark via replaceWith leaves the text
    // split into adjacent text nodes, and wrapOffsets requires both
    // range ends in ONE text node - so without host.normalize() after
    // the unwrap, every pass after the first silently dropped the mark
    // (WebKitGTK: enabling grammar on an open doc showed nothing).
    await loadDoc(page, `# Proofing\n\nI has a dog.`);
    await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          setGrammar: (on: boolean) => void;
        }
      ).setGrammar(true),
    );
    const grammar = page.locator("#the-doc span.folio-grammar");
    await expect(grammar).toHaveCount(1, { timeout: 90_000 });
    await expect(grammar).toHaveText("has");

    // force another mark pass (grammar off -> on): unwrap + re-wrap
    await page.evaluate(() => {
      const el = document.querySelector("folio-doc") as unknown as {
        setGrammar: (on: boolean) => void;
      };
      el.setGrammar(false);
      el.setGrammar(true);
    });
    await expect(grammar).toHaveCount(1, { timeout: 15_000 });
    await expect(grammar).toHaveText("has");
    // the model never saw the span
    expect(await proseTexts(page)).toEqual(["I has a dog."]);
  });

  test("edits landing while a grammar pass is in flight never nest marks or scramble hits", async ({
    page,
  }) => {
    // Regression: mark passes are async (they await the wasm lint); a
    // pass scheduled while another was in flight used to run
    // concurrently, interleaving unwrap/rewrap - nested mark spans and
    // grammarHits indices pointing at the wrong hit. Now passes are
    // serialized (runMarks guard in src/component.ts).
    await loadDoc(page, `# Proofing\n\nI saw the the dog. wordd teh.`);
    await expect(misspelled(page)).toHaveCount(2, { timeout: 15_000 });

    // enable grammar, then type immediately - the wasm load + lint is
    // in flight while input keeps scheduling mark passes
    await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          setGrammar: (on: boolean) => void;
        }
      ).setGrammar(true),
    );
    await page.locator("#the-doc p").first().click();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.type("the the wordd ");
      await page.waitForTimeout(50);
    }

    // grammar marks eventually appear despite the typing storm
    const grammar = page.locator("#the-doc span.folio-grammar");
    await expect(grammar.first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);

    // no mark ever contains another mark
    const nested = page.locator(
      "#the-doc .folio-misspelled .folio-misspelled, " +
        "#the-doc .folio-grammar .folio-grammar, " +
        "#the-doc .folio-misspelled .folio-grammar, " +
        "#the-doc .folio-grammar .folio-misspelled",
    );
    await expect(nested).toHaveCount(0);

    // and a grammar mark still maps to a live hit: its menu opens with
    // that hit's suggestions and applying the first one edits the text
    await grammar.first().click({ button: "right" });
    await expect(proofMenu(page)).toBeVisible();
    await expect(proofMenu(page)).toHaveAttribute("aria-label", "Grammar");
    const before = await page.locator("#the-doc p").first().textContent();
    await proofMenu(page).locator("button").first().click();
    await expect(proofMenu(page)).toBeHidden();
    const after = await page.locator("#the-doc p").first().textContent();
    expect(after).not.toBe(before);
    // the fix landed in the model too (the repeated word is gone)
    expect((await proseTexts(page))[0]).toContain("I saw the dog.");
  });

  test("grammar marks also show in the source view and its menu applies them", async ({
    page,
  }) => {
    await loadDoc(page, `# Proofing\n\nI saw the the dog.`);
    await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          setGrammar: (on: boolean) => void;
        }
      ).setGrammar(true),
    );
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-wrap")).toBeVisible();
    const gram = page.locator("#md-view .folio-grammar");
    await expect(gram).toHaveCount(1, { timeout: 90_000 });
    await expect(gram).toHaveText("the the");
    // source itself unchanged
    expect(await page.locator("#editor").inputValue()).toContain("the the");

    // right-click inside the mark -> Grammar menu -> first suggestion
    await page.locator("#editor").evaluate((el) => {
      const ta = el as HTMLTextAreaElement;
      const v = ta.value;
      const i = v.indexOf("the the");
      ta.focus();
      ta.setSelectionRange(i + 2, i + 2);
      ta.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 200,
        }),
      );
    });
    const menu = page.locator(".proof-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-label", "Grammar");
    await menu.locator("button").first().click();
    await expect(menu).toBeHidden();
    expect(await page.locator("#editor").inputValue()).toContain(
      "I saw the dog.",
    );
    await expect(gram).toHaveCount(0);
  });
});
