import { expect, test, type Page } from "@playwright/test";
import { insertFrom } from "./toolbar-helpers";

/**
 * Flashcard decks (spec: docs/specs/flashcards.md): a `::: flashcards`
 * figure block - editable card rows in document view, an inspector bar,
 * and a session-only study mode (flip / match / choice) with SRS state
 * in localStorage, never in the Markdown.
 */

const DECK =
  "::: flashcards {#food-animals}\n" +
  'title: "Food & animals"\n' +
  'card: "perro" | "dog"\n' +
  'card: "gato" | "cat"\n' +
  'card: "casa" | "house"\n' +
  'card: "libro" | "book"\n' +
  'card: "agua" | "water"\n' +
  ":::\n";

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await waitForDocument(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

async function source(page: Page): Promise<string> {
  await page.locator("#btn-markdown").click();
  const md = await page.locator("#editor").inputValue();
  await page.locator("#btn-view").click();
  return md;
}

test.describe("flashcard decks", () => {
  test("a hand-typed directive renders the deck figure with rows and round-trips", async ({
    page,
  }) => {
    await loadDoc(page, `# Vocab\n\n${DECK}\nAfter.`);
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await expect(figure).toHaveCount(1);
    await expect(figure.locator(".folio-fc-label .fc-title")).toHaveText(
      "Food & animals",
    );
    await expect(figure.locator(".folio-fc-label")).toContainText("5 cards");
    // Fresh browser profile: every card is due.
    await expect(figure.locator(".fc-badge")).toHaveText("5 due");
    // One row per card, front and back as inputs.
    await expect(figure.locator(".folio-fc-row")).toHaveCount(5);
    await expect(
      figure.locator('.folio-fc-row[data-card="0"] input.fc-front'),
    ).toHaveValue("perro");
    await expect(
      figure.locator('.folio-fc-row[data-card="0"] input.fc-back'),
    ).toHaveValue("dog");
    // A figure, not an editing surface.
    const editable = await figure.evaluate(
      (el) => (el as HTMLElement).isContentEditable,
    );
    expect(editable).toBe(false);
    // Round-trip: the directive is already canonical.
    const md = await source(page);
    expect(md).toContain("::: flashcards {#food-animals}");
    expect(md).toContain('card: "perro" | "dog"');
  });

  test("the insert menu adds a deck with one starter card", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await insertFrom(page, "btn-flashcards");
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await expect(figure).toHaveCount(1);
    await expect(figure.locator(".folio-fc-row")).toHaveCount(1);
    const md = await source(page);
    expect(md).toContain("::: flashcards {#deck-1}");
    expect(md).toContain('card: "Question" | "Answer"');
  });

  test("editing a card front in place reaches the Markdown source", async ({
    page,
  }) => {
    await loadDoc(page, DECK);
    const front = page.locator(
      '#the-doc .folio-fc-row[data-card="1"] input.fc-front',
    );
    await front.fill("gata");
    await front.press("Enter");
    const md = await source(page);
    expect(md).toContain('card: "gata" | "cat"');
  });

  test("the inspector edits the deck title; add and delete update rows", async ({
    page,
  }) => {
    await loadDoc(page, DECK);
    const figure = page.locator("#the-doc figure.folio-flashcards");
    // Reveal the inspector (click inside the figure), then edit title.
    await figure.locator(".folio-fc-label").click();
    const bar = figure.locator(".folio-inspector");
    await expect(bar).toBeVisible();
    const title = bar.locator("input.insp-fc-title");
    await title.fill("Animals");
    await title.press("Enter");
    await expect(figure.locator(".folio-fc-label .fc-title")).toHaveText(
      "Animals",
    );
    // Add a card.
    await figure.locator(".folio-fc-add").click();
    await expect(figure.locator(".folio-fc-row")).toHaveCount(6);
    // Delete the first card.
    await figure
      .locator(
        '.folio-fc-row[data-card="0"] .fc-icon-btn[aria-label^="delete"]',
      )
      .click();
    await expect(figure.locator(".folio-fc-row")).toHaveCount(5);
    const md = await source(page);
    expect(md).toContain('title: "Animals"');
    expect(md).not.toContain('card: "perro"');
    expect(md).toContain('card: "New card" | ""');
  });

  test("Backspace on the selected figure removes the deck", async ({
    page,
  }) => {
    await loadDoc(page, DECK);
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.click();
    await page.keyboard.press("Backspace");
    await expect(figure).toHaveCount(0);
    const md = await source(page);
    expect(md).not.toContain("flashcards");
  });

  test("study mode flips and grades without touching the file", async ({
    page,
  }) => {
    await loadDoc(page, DECK);
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.locator(".folio-fc-label").click();
    await figure
      .locator(".folio-inspector button", { hasText: "Study deck" })
      .click();
    // Study UI replaces the rows for the session.
    await expect(figure.locator(".folio-fc-study")).toBeVisible();
    await expect(
      figure.locator(".folio-fc-card .folio-fc-word").first(),
    ).toBeVisible();
    // Flip with Space: the back and the grade buttons appear.
    await page.keyboard.press("Space");
    await expect(figure.locator(".fc-srs button")).toHaveCount(4);
    // Grade "Good" (key 3): advances and records SRS locally.
    await page.keyboard.press("3");
    await expect(figure.locator(".folio-fc-head")).toContainText("Card 2 of 5");
    // The due badge dropped by one (localStorage, not the file).
    await expect(figure.locator(".fc-badge")).toHaveText("4 due");
    // Esc exits study mode; the Markdown never changed.
    await page.keyboard.press("Escape");
    await expect(figure.locator(".folio-fc-study")).toHaveCount(0);
    await expect(figure.locator(".folio-fc-row")).toHaveCount(5);
    const md = await source(page);
    expect(md).toContain("::: flashcards {#food-animals}");
    expect(md).not.toContain("studying");
  });

  test("match mode pairs a prompt with its word", async ({ page }) => {
    await loadDoc(page, DECK);
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.locator(".folio-fc-label").click();
    await figure
      .locator(".folio-inspector button", { hasText: "Study deck" })
      .click();
    await figure.locator(".fc-mode-btn", { hasText: "Match" }).click();
    await expect(figure.locator(".folio-fc-head")).toContainText("0 of 5");
    // Cards have no sound, so prompts show the back text; the study
    // order is shuffled, so resolve tiles dynamically.
    const backs = ["dog", "cat", "house", "book", "water"];
    const fronts = ["perro", "gato", "casa", "libro", "agua"];
    const left = figure.locator(".folio-fc-col").first();
    const right = figure.locator(".folio-fc-col").nth(1);
    const leftTiles = left.locator(".folio-fc-tile");
    const rightTiles = right.locator(".folio-fc-tile");
    const t0 = (await leftTiles.nth(0).innerText()).trim();
    const f0 = fronts[backs.indexOf(t0)] ?? "";
    await leftTiles.nth(0).click();
    await rightTiles.filter({ hasText: f0 }).first().click();
    await expect(figure.locator(".folio-fc-head")).toContainText("1 of 5");
    await expect(figure.locator(".folio-fc-tile.ok")).toHaveCount(2);
    // A wrong pick flashes red: second prompt against a different word.
    const t1 = (await leftTiles.nth(1).innerText()).trim();
    const f1 = fronts[backs.indexOf(t1)] ?? "";
    const wrong = fronts.find((f) => f !== f1) ?? "";
    await leftTiles.nth(1).click();
    await rightTiles.filter({ hasText: wrong }).first().click();
    await expect(figure.locator(".folio-fc-tile.bad")).toHaveCount(1);
  });

  test("choice mode offers four options from the deck and grades by key", async ({
    page,
  }) => {
    await loadDoc(page, DECK);
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.locator(".folio-fc-label").click();
    await figure
      .locator(".folio-inspector button", { hasText: "Study deck" })
      .click();
    await figure.locator(".fc-mode-btn", { hasText: "Choice" }).click();
    await expect(figure.locator(".folio-fc-opts .folio-fc-tile")).toHaveCount(
      4,
    );
    await page.keyboard.press("1");
    // The correct option is always marked ok; a wrong pick is
    // additionally marked bad on the picked tile.
    const ok = figure.locator(".folio-fc-opts .folio-fc-tile.ok");
    const bad = figure.locator(".folio-fc-opts .folio-fc-tile.bad");
    await expect(ok).toHaveCount(1);
    const picked = figure.locator(".folio-fc-opts .folio-fc-tile").first();
    await expect(bad).toHaveCount(
      (await picked.getAttribute("class"))?.includes("bad") ? 1 : 0,
    );
    // Space advances.
    await page.keyboard.press("Space");
    await expect(figure.locator(".folio-fc-head")).toContainText("Card 2 of 5");
  });

  test("a card can reference an audio block by id", async ({ page }) => {
    await loadDoc(
      page,
      "::: audio {#kalb}\nsrc: https://example.com/kalb.mp3\n:::\n\n" +
        '::: flashcards {#d}\ncard: "perro" | "dog" | @kalb\n:::\n',
    );
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await expect(
      figure.locator(".folio-fc-row .fc-icon-btn.has-audio"),
    ).toHaveCount(1);
    const md = await source(page);
    expect(md).toContain('card: "perro" | "dog" | @kalb');
  });
});
