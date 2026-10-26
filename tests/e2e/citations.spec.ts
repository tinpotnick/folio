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
    await expect(note).toContainText("gruber2004");
    await expect(note).toContainText("wilkinson2005");
    await page.emulateMedia({ media: "print" });
    await expect(note).toBeHidden();
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
    expect(md).toContain("## References\n\n```bibtex\n@article{knuth1984,");
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
});
