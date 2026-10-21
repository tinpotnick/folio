import { expect, test, type Page } from "@playwright/test";
import { insertFrom } from "./toolbar-helpers";

/**
 * The code header and syntax highlighting (spec: docs/specs/
 * code-blocks.md): every fenced code block carries one header - the
 * language picker, plus the controls a language adds (strudel's
 * player) - following the one inspector contract; supported
 * languages are syntax-highlighted without touching the text.
 */
async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const text = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return text;
}

const PY =
  "# T\n\nsome prose\n\n```python\ndef add(a, b):\n    return a + b\n```\n";

test.describe("code blocks: header and highlighting", () => {
  test("a click reveals the code header with the language; outside hides it", async ({
    page,
  }) => {
    await loadDoc(page, PY);
    const figure = page.locator("#the-doc figure.folio-codeblock");
    const bar = figure.locator(".folio-inspector");
    await expect(bar).toBeHidden();
    await figure.locator("pre.folio-code").click();
    await expect(bar).toBeVisible();
    await expect(bar.locator("select.code-lang")).toHaveValue("python");
    // No player for a non-music language.
    await expect(bar.locator(".strudel-play")).toHaveCount(0);
    await page.locator("#the-doc p").first().click();
    await expect(bar).toBeHidden();
    // Esc inside the header dismisses it early.
    await figure.locator("pre.folio-code").click();
    await bar.locator("select.code-lang").focus();
    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
  });

  test("supported languages are syntax-highlighted; the text is untouched", async ({
    page,
  }) => {
    await loadDoc(page, PY);
    const code = page.locator("#the-doc figure.folio-codeblock pre code");
    await expect(code.locator(".hljs-keyword").first()).toHaveText("def");
    await expect(code.locator(".hljs-title")).toHaveText("add");
    await expect(code).toHaveText("def add(a, b):\n    return a + b");
    expect(await source(page)).toBe(PY);
  });

  test("plain text and unknown languages render uncolored", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "# T\n\n```\nplain words\n```\n\n```foo\nbar baz\n```\n",
    );
    const figures = page.locator("#the-doc figure.folio-codeblock");
    await expect(figures).toHaveCount(2);
    await page.waitForTimeout(300);
    await expect(figures.locator("[class^=hljs]")).toHaveCount(0);
    // An unlisted tag stays selectable as itself.
    await figures.nth(1).locator("pre").click();
    await expect(figures.nth(1).locator("select.code-lang")).toHaveValue("foo");
  });

  test("changing the language rewrites the fence tag and re-highlights", async ({
    page,
  }) => {
    await loadDoc(page, PY);
    let figure = page.locator("#the-doc figure.folio-codeblock");
    await figure.locator("pre.folio-code").click();
    await figure.locator("select.code-lang").selectOption("rust");
    expect(await source(page)).toContain("```rust\ndef add");
    // Plain text drops the tag (a bare fence) and the colors.
    figure = page.locator("#the-doc figure.folio-codeblock");
    await figure.locator("pre.folio-code").click();
    await figure.locator("select.code-lang").selectOption("");
    await expect(figure.locator("[class^=hljs]")).toHaveCount(0);
    expect(await source(page)).toContain("```\ndef add");
    // Strudel adds the player to the same header.
    figure = page.locator("#the-doc figure.folio-codeblock");
    await figure.locator("pre.folio-code").click();
    await figure.locator("select.code-lang").selectOption("strudel");
    await expect(page.locator("#the-doc figure.folio-strudel")).toHaveCount(1);
    await expect(
      page.locator("#the-doc figure.folio-strudel .strudel-play"),
    ).toBeVisible();
    expect(await source(page)).toContain("```strudel\ndef add");
  });

  test("edits are recolored when the caret leaves the block", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\nafter\n\n```javascript\nlet x = 1;\n```\n");
    const code = page.locator("#the-doc figure.folio-codeblock pre code");
    await expect(code.locator(".hljs-keyword")).toHaveCount(1);
    await code.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" const y = 2;");
    await page.locator("#the-doc p").first().click();
    await expect(code.locator(".hljs-keyword")).toHaveCount(2);
    await expect(code).toHaveText("let x = 1; const y = 2;");
  });

  test("the code header stays in view inside a long block", async ({
    page,
  }) => {
    const long = Array.from({ length: 80 }, (_, i) => `line_${i} = ${i}`);
    await loadDoc(page, `# T\n\n\`\`\`python\n${long.join("\n")}\n\`\`\`\n`);
    const figure = page.locator("#the-doc figure.folio-codeblock");
    // Scroll the block's end into view and click near it: the
    // block's top (where the header lives) is far above.
    const pre = figure.locator("pre.folio-code");
    await pre.evaluate((el) => el.scrollIntoView({ block: "end" }));
    const h = (await pre.boundingBox())?.height ?? 0;
    await pre.click({ position: { x: 40, y: h - 30 } });
    const bar = figure.locator(".folio-inspector");
    await expect(bar).toBeVisible();
    const y = (await bar.boundingBox())?.y ?? -1;
    // Below the sticky app header (52px), inside the viewport.
    expect(y).toBeGreaterThanOrEqual(50);
    expect(y).toBeLessThan(120);
  });

  test("the palette command opens the caret block's language picker", async ({
    page,
  }) => {
    await loadDoc(page, PY);
    await page.locator("#the-doc figure.folio-codeblock pre code").click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("code language");
    await page
      .locator("#palette-list .palette-item", {
        hasText: "Change the code block language",
      })
      .click();
    const picker = page.locator("#the-doc select.code-lang");
    await expect(picker).toBeVisible();
    await expect(picker).toBeFocused();
  });
});

// Regressions from the JSCAD first-contact eval: they hit EVERY code
// block, not just models.
test.describe("code body integrity", () => {
  test("text typed into a NEW (empty) code block is kept", async ({ page }) => {
    await loadDoc(page, "# T\n\nIntro\n");
    await page.locator("#the-doc p", { hasText: "Intro" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await insertFrom(page, "btn-code");
    await page.keyboard.type("line one");
    await page.keyboard.press("Enter");
    await page.keyboard.type("line two");
    // innerText: Enter in code inserts a <br> (a newline to the model).
    await expect
      .poll(() =>
        page
          .locator("#the-doc pre.folio-code > code")
          .evaluate((el) => (el as HTMLElement).innerText),
      )
      .toBe("line one\nline two");
    expect(await source(page)).toContain("```\nline one\nline two\n```");
  });

  test("select-all + retype in a code body keeps plain text, no markup", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n```js\nconst a = 1\n```\n");
    const code = page.locator("#the-doc pre.folio-code > code");
    await code.click();
    // Ctrl+A selects the CODE (not the document).
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await expect(page.locator("#the-doc h1")).toHaveText("T");
    await page.keyboard.type("let b = 2");
    await expect(page.locator("#the-doc pre.folio-code > code")).toHaveText(
      "let b = 2",
    );
    const html = await page
      .locator("#the-doc pre.folio-code")
      .evaluate((el) => el.innerHTML);
    expect(html).not.toMatch(/<font|style=/);
    expect(await source(page)).toContain("```js\nlet b = 2\n```");
  });
});

// Regression: the DOM -> model sync rebuilt code blocks from lang and
// text only, so typing ANYWHERE dropped every fence's info string
// (```js title="x", a model's params=@table row=2).
test("typing elsewhere keeps a fence's info string", async ({ page }) => {
  await loadDoc(
    page,
    '# T\n\nIntro\n\n```js title="hello.js"\nconst a = 1\n```\n',
  );
  await page.locator("#the-doc p", { hasText: "Intro" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" more");
  expect(await source(page)).toContain(
    '```js title="hello.js"\nconst a = 1\n```',
  );
});
