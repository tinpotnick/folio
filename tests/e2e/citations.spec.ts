import { expect, test, type Page } from "@playwright/test";

/** Citations and the reference list (docs/specs/citations.md). */

async function open(page: Page, doc = "demo/examples/paper.md"): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
  await page.goto(`/?doc=${doc}`);
  await page.locator("#the-doc h1").first().waitFor();
}

const markdown = async (page: Page): Promise<string> => {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  return page.locator("#editor").inputValue();
};

const setMarkdown = async (page: Page, md: string): Promise<void> => {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  await page.locator("#editor").fill(md);
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-view")?.click(),
  );
};

test.describe("citations", () => {
  test("citations read author-date; the list is alphabetical", async ({
    page,
  }) => {
    await open(page);
    const cites = page.locator("#the-doc span.folio-cite");
    await expect(cites.first()).toHaveText("(Knuth, 1984)");
    await expect(cites.nth(1)).toHaveText("(Tufte, 1983, pp. 91–93)");
    await expect(
      page.locator("#the-doc span.folio-cite", { hasText: "Gruber" }),
    ).toHaveText("Gruber (2004)");
    const keys = await page
      .locator("#the-doc ol.folio-refs li")
      .evaluateAll((lis) => lis.map((li) => (li as HTMLElement).dataset.key));
    expect(keys).toEqual([
      "gruber2004",
      "kluyver2016",
      "knuth1984",
      "lamport1994",
      "macfarlane2024",
      "satyanarayan2017",
      "tufte1983",
      "wilkinson2005",
    ]);
    await expect(page.locator("#the-doc ol.folio-refs li").nth(2)).toHaveText(
      "Knuth, D. E. (1984). Literate Programming. The Computer Journal, 27(2), 97–111. https://doi.org/10.1093/comjnl/27.2.97",
    );
  });

  test("the numeric style renumbers citations and the list", async ({
    page,
  }) => {
    await open(page);
    await page.locator("#btn-settings").click();
    await page.locator("#set-citation-style").selectOption("numeric");
    await page.locator("#settings-form button[type=submit]").click();
    const cites = page.locator("#the-doc span.folio-cite");
    await expect(cites.first()).toHaveText("[1]");
    await expect(cites.nth(1)).toHaveText("[2, pp. 91–93]");
    await expect(
      page.locator("#the-doc ol.folio-refs li .ref-label").first(),
    ).toHaveText("[1]");
    await expect(
      page.locator("#the-doc ol.folio-refs li").first(),
    ).toHaveAttribute("data-key", "knuth1984");
    expect(await markdown(page)).toMatch(/citation\.style: "?numeric"?/);
  });

  test("Insert › Citation picks a reference and writes [@key]", async ({
    page,
  }) => {
    await open(page);
    const para = page.locator("#the-doc p", { hasText: "Keeping the data" });
    await para.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Compare");
    await page.locator("#btn-insert-menu").click();
    await page.locator("#insert-menu #btn-insert-cite").click();
    await expect(page.locator("#palette-input")).toHaveValue("Cite: ");
    await page.locator("#palette-input").fill("Cite: Tufte");
    await page.keyboard.press("Enter");
    await expect(para).toContainText("Compare (Tufte, 1983)");
    expect(await markdown(page)).toContain("Compare [@tufte1983]");
  });

  test("clicking a citation goes to its entry", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await open(page);
    const entry = page.locator(
      '#the-doc ol.folio-refs li[data-key="knuth1984"]',
    );
    await expect(entry).not.toBeInViewport();
    await page.locator("#the-doc span.folio-cite").first().click();
    await expect(entry).toBeInViewport();
    await expect(entry).toHaveClass(/folio-xref-target/);
  });

  test("a missing key says so; uncited entries show on screen only", async ({
    page,
  }) => {
    await open(page);
    const md = await markdown(page);
    await setMarkdown(
      page,
      md
        .replace("[@wilkinson2005]", "[@nobody2020]")
        .replace("@gruber2004 designed", "Gruber designed"),
    );
    const missing = page.locator("#the-doc span.folio-cite", {
      hasText: "nobody2020?",
    });
    await expect(missing).toHaveClass(/folio-cite-missing/);
    await expect(missing).toHaveAttribute(
      "title",
      /No reference with the key "nobody2020"/,
    );
    const note = page.locator("#the-doc .folio-refs-note");
    await expect(note).toContainText("Not cited yet");
    // Formatted, so a paste can be checked before it is cited.
    const waiting = page.locator("#the-doc ol.folio-refs-uncited li");
    await expect(waiting).toHaveText([
      "Gruber, J. (2004). Markdown. https://daringfireball.net/projects/markdown/",
      "Wilkinson, L. (2005). The Grammar of Graphics (2nd ed.). Springer. https://doi.org/10.1007/0-387-28695-0",
    ]);
    await page.emulateMedia({ media: "print" });
    await expect(note).toBeHidden();
    await expect(waiting.first()).toBeHidden();
  });

  test("a bibliography comes from the Insert menu; Citation explains first", async ({
    page,
  }) => {
    await open(page, "demo/examples/poem.md");
    await page.locator("#the-doc p").first().click();
    await page.locator("#btn-insert-menu").click();
    await page.locator("#insert-menu #btn-insert-cite").click();
    await expect(page.locator("#status")).toContainText("No references yet");
    await page.locator("#btn-insert-menu").click();
    await page
      .locator('#insert-menu [data-insert="Insert a bibliography"]')
      .click();
    await expect(
      page.locator("#the-doc h2", { hasText: "References" }),
    ).toBeVisible();
    await expect(page.locator("#the-doc .folio-refs-note")).toContainText(
      "Nothing cited yet",
    );
    const md = await markdown(page);
    expect(md).toContain(
      "## References\n\n```bibtex\n% An example entry. Paste your own BibTeX here - it replaces this.\n@article{knuth1984,",
    );
  });

  test("printed, a citation is plain text", async ({ page }) => {
    await open(page);
    await page.emulateMedia({ media: "print" });
    const style = await page.evaluate(() => {
      const a = document
        .querySelector("#the-doc")
        ?.shadowRoot?.querySelector("span.folio-cite");
      const p = a?.closest("p");
      if (!a || !p) return null;
      return {
        color: getComputedStyle(a).color,
        text: getComputedStyle(p).color,
        border: getComputedStyle(a).borderBottomStyle,
      };
    });
    expect(style?.color).toBe(style?.text);
    expect(style?.border).toBe("none");
  });

  test("the paper example round-trips byte for byte", async ({ page }) => {
    const source = await (
      await page.request.get("/demo/examples/paper.md")
    ).text();
    await open(page);
    expect(await markdown(page)).toBe(source);
  });

  test('Ctrl+K "cite" offers the command first; a page goes after the name', async ({
    page,
  }) => {
    await open(page);
    const para = page.locator("#the-doc p", { hasText: "Keeping the data" });
    await para.click();
    await page.keyboard.press("Control+End");
    await para.click();
    await page.keyboard.press("Control+k");
    await page.keyboard.type("cite");
    await expect(page.locator("#palette-list > *").first()).toContainText(
      "Insert a citation",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-input")).toHaveValue("Cite: ");
    await page.keyboard.type("Tufte p. 12");
    await expect(page.locator("#palette-list > *").first()).toContainText(
      "Cite: Tufte 1983",
    );
    await expect(page.locator("#palette-list > *").first()).toContainText(
      "Reference",
    );
    await expect(page.locator(".palette-foot")).toContainText(
      "Enter to cite with p. 12",
    );
    await page.keyboard.press("Enter");
    expect(await markdown(page)).toContain("[@tufte1983, p. 12]");
  });

  test("a second citation joins the first; a word after gets its space", async ({
    page,
  }) => {
    await open(page);
    const md = await markdown(page);
    await setMarkdown(
      page,
      md.replace("Keeping the data", "Xy Keeping the data"),
    );
    const para = page.locator("#the-doc p", { hasText: "Keeping the data" });
    // Caret between "Xy" and "Keeping".
    await para.evaluate((p) => {
      const t = p.firstChild as Text;
      const r = document.createRange();
      r.setStart(t, 2);
      r.collapse(true);
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    });
    for (const name of ["Tufte", "Knuth"]) {
      await page.keyboard.press("Control+k");
      await page.locator("#palette-input").fill(`Cite: ${name}`);
      await page.keyboard.press("Enter");
    }
    await expect(para).toContainText("Xy (Knuth, 1984; Tufte, 1983) Keeping");
    expect(await markdown(page)).toContain(
      "Xy [@tufte1983; @knuth1984] Keeping",
    );
  });

  test("a citation typed in a paragraph shows once the caret leaves", async ({
    page,
  }) => {
    await open(page);
    const para = page.locator("#the-doc p", { hasText: "Keeping the data" });
    await para.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("As [@knuth1984, p. 99] says, ");
    // Typed, it is still text (the paragraph's own citation is the one).
    await expect(para.locator("span.folio-cite")).toHaveCount(1);
    await page.locator("#the-doc h2", { hasText: "Discussion" }).click();
    await expect(para.locator("span.folio-cite")).toHaveCount(2);
    await expect(para.locator("span.folio-cite").first()).toHaveText(
      "(Knuth, 1984, p. 99)",
    );
    expect(await markdown(page)).toContain("As [@knuth1984, p. 99] says, ");
  });

  test("the bibliography: a paste replaces the example; Esc and print hide the source", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "demo/examples/poem.md");
    await page.locator("#the-doc p").first().click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("Insert a bibliography");
    await page.keyboard.press("Enter");
    const fig = page.locator("#the-doc figure.folio-bibtex");
    await fig.locator(".code-view").click();
    await expect(fig.locator(".insp-hint")).toContainText("Google Scholar");
    await page.evaluate(() =>
      navigator.clipboard.writeText(
        "@article{knuth1984literate,\n  title={Literate programming},\n  author={Knuth, Donald Ervin},\n  journal={The computer journal},\n  year={1984}\n}",
      ),
    );
    await page.keyboard.press("Control+v");
    await expect(fig.locator(".folio-refs-uncited li")).toHaveText([
      "Knuth, D. E. (1984). Literate programming. The Computer Journal.",
    ]);
    expect(await markdown(page)).not.toContain("An example entry");
    await page.evaluate(() =>
      document.querySelector<HTMLElement>("#btn-view")?.click(),
    );
    await fig.locator(".code-view").click();
    await expect(fig.locator("pre.folio-code")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(fig.locator("pre.folio-code")).toBeHidden();
    await expect(fig.locator(".folio-inspector")).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await expect(fig.locator("pre.folio-code")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(fig.locator("pre.folio-code")).toBeHidden();
  });
});
