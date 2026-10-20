import { expect, test, type Page } from "@playwright/test";

/**
 * Strudel music blocks (ADR-0014, spec: docs/specs/
 * strudel-blocks.md): a ```strudel fence renders as a figure with
 * a player in its inspector; the block stays a plain fence in the
 * model, so round-trip identity holds.
 */
async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

const SRC = '# T\n\n```strudel\nnote("c a f e")\n```\n';

test.describe("strudel music blocks", () => {
  test("a strudel fence renders a figure with the source and inspector", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await expect(figure).toBeVisible();
    await expect(figure.locator("pre.strudel-source")).toHaveText(
      'note("c a f e")',
    );
    await expect(figure.locator(".folio-inspector .strudel-play")).toBeHidden();
  });

  test("clicking the figure reveals the player inspector; a click outside hides it", async ({
    page,
  }) => {
    // The outside-click target is the paragraph, so the document
    // needs one (SRC alone has no <p> - the click hung forever).
    await loadDoc(
      page,
      `# T\n\nsome prose\n\n${"```"}strudel\nnote("c a f e")\n${"```"}\n`,
    );
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    const bar = figure.locator(".folio-inspector");
    await expect(bar).toBeVisible();
    await expect(bar.locator(".strudel-play")).toBeVisible();
    await expect(bar.locator(".strudel-stop")).toBeVisible();
    await expect(bar.locator("textarea")).toHaveValue('note("c a f e")');
    // One inspector contract: an outside click hides it.
    await page.locator("#the-doc p").first().click();
    await expect(bar).toBeHidden();
  });

  test("a strudel fence survives a full view round-trip", async ({ page }) => {
    await loadDoc(page, SRC);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe(SRC);
  });

  test("editing the inspector source updates the model and the body", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    const ta = figure.locator(".folio-inspector textarea");
    await ta.fill('note("f e d c")');
    await page.keyboard.press("Enter");
    await expect(figure.locator("pre.strudel-source")).toHaveText(
      'note("f e d c")',
    );
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'note("f e d c")',
    );
  });

  test("editing prose around a strudel figure preserves it", async ({
    page,
  }) => {
    await loadDoc(
      page,
      '# T\n\nbefore\n\n```strudel\nnote("c a f e")\n```\n\nafter\n',
    );
    await page.locator("#the-doc p", { hasText: "before" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("middle");
    const doc = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => {
            blocks: { kind: string; lang?: string }[];
          };
        }
      ).getDoc(),
    );
    const strudel = doc.blocks.filter(
      (b) => b.kind === "code" && b.lang === "strudel",
    );
    expect(strudel.length).toBe(1);
  });

  test("Enter on a strudel figure does not split or edit it", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await page.keyboard.press("Enter");
    await expect(figure).toBeVisible();
    await expect(figure.locator("pre.strudel-source")).toHaveText(
      'note("c a f e")',
    );
  });

  test("Backspace on a selected strudel figure removes it", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await page.keyboard.press("Backspace");
    await expect(figure).toHaveCount(0);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe("# T\n");
  });

  test("the play button starts audio without a network fetch", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http") && !r.url().includes("localhost")) {
        requests.push(r.url());
      }
    });
    await figure.locator(".folio-inspector .strudel-play").click();
    await expect(
      figure.locator(".folio-inspector .strudel-error"),
    ).toBeHidden();
    await page.waitForTimeout(1000);
    expect(requests).toEqual([]);
  });

  test("playing highlights the sounding tokens and sweeps the cycle", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    const pre = figure.locator("pre.strudel-source");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    // The sweep bar exists and switches on with the scheduler.
    const sweep = pre.locator(".strudel-sweep");
    await expect(sweep).toBeVisible();
    await expect(sweep).toHaveAttribute("data-on", "1", {
      timeout: 10_000,
    });
    // Sounding mini-notation tokens flash: at least one hit span
    // appears (the pattern's first cycle plays c, a, f, e).
    await expect(pre.locator(".strudel-hit").first()).toBeVisible({
      timeout: 10_000,
    });
    // The sweep survives the hit spans' DOM rebuilds (the first
    // flash replaces the pre's children - the bar must re-attach).
    await expect(pre.locator(".strudel-sweep")).toHaveAttribute("data-on", "1");
    // The play button reflects playing state.
    await expect(
      figure.locator(".folio-inspector .strudel-play"),
    ).toContainText("Playing");
    // Stop: the highlight chrome is removed and the plain source
    // text is restored.
    await figure.locator(".folio-inspector .strudel-stop").click();
    await expect(
      figure.locator(".folio-inspector .strudel-play"),
    ).toContainText("Play");
    await expect(pre.locator(".strudel-hit")).toHaveCount(0);
    await expect(pre.locator(".strudel-sweep")).toHaveCount(0);
    await expect(pre).toHaveText('note("c a f e")');
  });

  test("the Markdown view highlights the strudel fence with fence tokens", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-view .tk-fence").first()).toBeVisible();
  });

  test("the toolbar music button inserts a strudel block", async ({ page }) => {
    // The button needs an editable caret: give the doc a paragraph.
    await loadDoc(page, "# T\n\nsome prose\n");
    await page.locator("#the-doc p").first().click();
    await page.locator("#btn-strudel").click();
    await expect(page.locator("#the-doc figure.folio-strudel")).toBeVisible();
  });

  test("the command palette offers the Strudel insert", async ({ page }) => {
    await loadDoc(page, SRC);
    await page.locator("#btn-search").click();
    await page.locator("#palette-input").fill("strudel");
    await expect(
      page.locator("#palette-list button", { hasText: "Strudel" }),
    ).toBeVisible();
  });
});
