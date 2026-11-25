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
    // Only unmatched tiles: matched ones are disabled and icon-only.
    const openLeft = left.locator(".folio-fc-tile:not(.ok)");
    const openRight = right.locator(".folio-fc-tile:not(.ok)");
    const t0 = (await openLeft.nth(0).innerText()).trim();
    const f0 = fronts[backs.indexOf(t0)] ?? "";
    await openLeft.nth(0).click();
    await openRight.filter({ hasText: f0 }).first().click();
    await expect(figure.locator(".folio-fc-head")).toContainText("1 of 5");
    await expect(figure.locator(".folio-fc-tile.ok")).toHaveCount(2);
    // A wrong pick flashes red: an open prompt against a different word.
    const t1 = (await openLeft.nth(0).innerText()).trim();
    const f1 = fronts[backs.indexOf(t1)] ?? "";
    const rightTexts = (await openRight.allInnerTexts()).map((t) => t.trim());
    const wrong = rightTexts.find((t) => t !== f1) ?? "";
    await openLeft.nth(0).click();
    await openRight.filter({ hasText: wrong }).first().click();
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

  test("an all-sound deck opens study in Match (Listen / Match columns)", async ({
    page,
  }) => {
    const wav =
      "data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAFAAAAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCSULtgvlCsoIpQXVAc79Cfr59vr0SPT69Pn2CfrO/dUBpQXKCOUKtgslC0IJRwaOAon+r/p29z/1TvTA9IX2avkW/RoB/QRJCJoKqgtZC7EJ4wZEA0T/Wfv794/1YPSR9Bz20vhh/F4AUAS/B0QKkwuCCxYKeAf4AwAACPyI+Or1fvRt9Lz1Qfiw+6L/nwMuB+QJbwugC3EKBQinBLwAvPwd+U/2p/RW9Gb1t/cD++b+6gKWBnsJQAuyC8EKighRBXcBcv25+b722/RK9Bv1Nvdb+iv+MgL3BQcJBgu4CwYLBwn3BTICK/5b+jb3G/VK9Nv0vva5+XL9dwFRBYoIwQqyC0ALewmWBuoC5v4D+7f3ZvVW9Kf0T/Yd+bz8vACnBAUIcQqgC28L5AkuB58Dov+w+0H4vPVt9H706vWI+Aj8AAD4A3gHFgqCC5MLRAq/B1AEXgBh/NL4HPaR9GD0j/X791n7RP9EA+MGsQlZC6oLmgpJCP0EGgEW/Wr5hfbA9E70P/V296/6if6OAkcGQgklC7YL5QrKCKUF1QHO/Qn6+fb69Ej0+vT59gn6zv3VAaUFygjlCrYLJQtCCUcGjgKJ/q/6dvc/9U70wPSF9mr5Fv0aAf0ESQiaCqoLWQuxCeMGRANE/1n7+/eP9WD0kfQc9tL4YfxeAFAEvwdECpMLggsWCngH+AMAAAj8iPjq9X70bfS89UH4sPui/58DLgfkCW8LoAtxCgUIpwS8ALz8HflP9qf0VvRm9bf3A/vm/uoClgZ7CUALsgvBCooIUQV3AXL9ufm+9tv0SvQb9Tb3W/or/jIC9wUHCQYLuAsGCwcJ9wUyAiv+W/o29xv1SvTb9L72ufly/XcBUQWKCMEKsgtAC3sJlgbqAub+A/u392b1VvSn9E/2Hfm8/LwApwQFCHEKoAtvC+QJLgefA6L/sPtB+Lz1bfR+9Or1iPgI/AAA+AN4BxYKgguTC0QKvwdQBF4AYfzS+Bz2kfRg9I/1+/dZ+0T/RAPjBrEJWQuqC5oKSQj9BBoBFv1q+YX2wPRO9D/1dvev+on+jgJHBkIJJQu2C+UKygilBdUBzv0J+vn2+vRI9Pr0+fYJ+s791QGlBcoI5Qq2CyULQglHBo4Cif6v+nb3P/VO9MD0hfZq+Rb9GgH9BEkImgqqC1kLsQnjBkQDRP9Z+/v3j/Vg9JH0HPbS+GH8XgBQBL8HRAqTC4ILFgp4B/gDAAAI/Ij46vV+9G30vPVB+LD7ov+fAy4H5AlvC6ALcQoFCKcEvAC8/B35T/an9Fb0ZvW39wP75v7qApYGewlAC7ILwQqKCFEFdwFy/bn5vvbb9Er0G/U291v6K/4yAvcFBwkGC7gLBgsHCfcFMgIr/lv6Nvcb9Ur02/S+9rn5cv13AVEFigjBCrILQAt7CZYG6gLm/gP7t/dm9Vb0p/RP9h35vPy8AKcEBQhxCqALbwvkCS4HnwOi/7D7Qfi89W30fvTq9Yj4CPwAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCQ==";
    await loadDoc(
      page,
      `::: audio {#a1}\nsrc: ${wav}\n:::\n\n` +
        `::: audio {#a2}\nsrc: ${wav}\n:::\n\n` +
        '::: flashcards {#d}\ntitle: "Spoken"\ncard: "perro" | "dog" | @a1\ncard: "gato" | "cat" | @a2\n:::\n',
    );
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.locator(".folio-fc-label").click();
    await figure
      .locator(".folio-inspector button", { hasText: "Study deck" })
      .click();
    // Match is the default for an audio-first deck.
    await expect(figure.locator(".folio-fc-match")).toBeVisible();
    const cols = figure.locator(".folio-fc-col");
    await expect(cols.nth(0).locator(".fc-col-label")).toHaveText("Listen");
    await expect(cols.nth(1).locator(".fc-col-label")).toHaveText("Match");
    // Audio prompts render play tiles; word tiles carry the front.
    await expect(cols.nth(0).locator(".folio-fc-tile .fc-wave")).toHaveCount(2);
    await expect(cols.nth(1).locator(".folio-fc-tile .fc-word")).toHaveCount(2);
  });

  test("while studying, clicking play neither reveals the bar nor breaks Space", async ({
    page,
  }) => {
    const wav =
      "data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAFAAAAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCSULtgvlCsoIpQXVAc79Cfr59vr0SPT69Pn2CfrO/dUBpQXKCOUKtgslC0IJRwaOAon+r/p29z/1TvTA9IX2avkW/RoB/QRJCJoKqgtZC7EJ4wZEA0T/Wfv794/1YPSR9Bz20vhh/F4AUAS/B0QKkwuCCxYKeAf4AwAACPyI+Or1fvRt9Lz1Qfiw+6L/nwMuB+QJbwugC3EKBQinBLwAvPwd+U/2p/RW9Gb1t/cD++b+6gKWBnsJQAuyC8EKighRBXcBcv25+b722/RK9Bv1Nvdb+iv+MgL3BQcJBgu4CwYLBwn3BTICK/5b+jb3G/VK9Nv0vva5+XL9dwFRBYoIwQqyC0ALewmWBuoC5v4D+7f3ZvVW9Kf0T/Yd+bz8vACnBAUIcQqgC28L5AkuB58Dov+w+0H4vPVt9H706vWI+Aj8AAD4A3gHFgqCC5MLRAq/B1AEXgBh/NL4HPaR9GD0j/X791n7RP9EA+MGsQlZC6oLmgpJCP0EGgEW/Wr5hfbA9E70P/V296/6if6OAkcGQgklC7YL5QrKCKUF1QHO/Qn6+fb69Ej0+vT59gn6zv3VAaUFygjlCrYLJQtCCUcGjgKJ/q/6dvc/9U70wPSF9mr5Fv0aAf0ESQiaCqoLWQuxCeMGRANE/1n7+/eP9WD0kfQc9tL4YfxeAFAEvwdECpMLggsWCngH+AMAAAj8iPjq9X70bfS89UH4sPui/58DLgfkCW8LoAtxCgUIpwS8ALz8HflP9qf0VvRm9bf3A/vm/uoClgZ7CUALsgvBCooIUQV3AXL9ufm+9tv0SvQb9Tb3W/or/jIC9wUHCQYLuAsGCwcJ9wUyAiv+W/o29xv1SvTb9L72ufly/XcBUQWKCMEKsgtAC3sJlgbqAub+A/u392b1VvSn9E/2Hfm8/LwApwQFCHEKoAtvC+QJLgefA6L/sPtB+Lz1bfR+9Or1iPgI/AAA+AN4BxYKgguTC0QKvwdQBF4AYfzS+Bz2kfRg9I/1+/dZ+0T/RAPjBrEJWQuqC5oKSQj9BBoBFv1q+YX2wPRO9D/1dvev+on+jgJHBkIJJQu2C+UKygilBdUBzv0J+vn2+vRI9Pr0+fYJ+s791QGlBcoI5Qq2CyULQglHBo4Cif6v+nb3P/VO9MD0hfZq+Rb9GgH9BEkImgqqC1kLsQnjBkQDRP9Z+/v3j/Vg9JH0HPbS+GH8XgBQBL8HRAqTC4ILFgp4B/gDAAAI/Ij46vV+9G30vPVB+LD7ov+fAy4H5AlvC6ALcQoFCKcEvAC8/B35T/an9Fb0ZvW39wP75v7qApYGewlAC7ILwQqKCFEFdwFy/bn5vvbb9Er0G/U291v6K/4yAvcFBwkGC7gLBgsHCfcFMgIr/lv6Nvcb9Ur02/S+9rn5cv13AVEFigjBCrILQAt7CZYG6gLm/gP7t/dm9Vb0p/RP9h35vPy8AKcEBQhxCqALbwvkCS4HnwOi/7D7Qfi89W30fvTq9Yj4CPwAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCQ==";
    await loadDoc(
      page,
      `::: audio {#a1}\nsrc: ${wav}\n:::\n\n` +
        `::: audio {#a2}\nsrc: ${wav}\n:::\n\n` +
        '::: flashcards {#d}\ncard: "perro" | "dog" | @a1\ncard: "gato" | "cat" | @a2\n:::\n',
    );
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.locator(".folio-fc-label").click();
    await figure
      .locator(".folio-inspector button", { hasText: "Study deck" })
      .click();
    // Switch to Flip; the bar must hide once study starts.
    await figure.locator(".fc-mode-btn", { hasText: "Flip" }).click();
    await expect(figure.locator(".folio-fc-study")).toBeVisible();
    await expect(figure.locator(".folio-inspector")).toBeHidden();
    // Click the play button: the bar stays hidden (no layout shift over
    // the card) and focus stays on the study root.
    await figure.locator(".folio-fc-study .fc-play").click();
    await expect(figure.locator(".folio-inspector")).toBeHidden();
    await expect(
      page.locator("#the-doc figure.folio-flashcards .folio-fc-word").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        const root = document.querySelector("folio-doc")?.shadowRoot;
        const ae = root?.activeElement as HTMLElement | null;
        return ae?.classList.contains("folio-fc-study") ?? false;
      }),
    ).toBe(true);
    // Space flips immediately: grade buttons appear.
    await page.keyboard.press("Space");
    await expect(figure.locator(".folio-fc-study .fc-srs button")).toHaveCount(
      4,
    );
  });

  test("study keypresses re-render only the study UI, not the document figures", async ({
    page,
  }) => {
    const wav =
      "data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAFAAAAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCSULtgvlCsoIpQXVAc79Cfr59vr0SPT69Pn2CfrO/dUBpQXKCOUKtgslC0IJRwaOAon+r/p29z/1TvTA9IX2avkW/RoB/QRJCJoKqgtZC7EJ4wZEA0T/Wfv794/1YPSR9Bz20vhh/F4AUAS/B0QKkwuCCxYKeAf4AwAACPyI+Or1fvRt9Lz1Qfiw+6L/nwMuB+QJbwugC3EKBQinBLwAvPwd+U/2p/RW9Gb1t/cD++b+6gKWBnsJQAuyC8EKighRBXcBcv25+b722/RK9Bv1Nvdb+iv+MgL3BQcJBgu4CwYLBwn3BTICK/5b+jb3G/VK9Nv0vva5+XL9dwFRBYoIwQqyC0ALewmWBuoC5v4D+7f3ZvVW9Kf0T/Yd+bz8vACnBAUIcQqgC28L5AkuB58Dov+w+0H4vPVt9H706vWI+Aj8AAD4A3gHFgqCC5MLRAq/B1AEXgBh/NL4HPaR9GD0j/X791n7RP9EA+MGsQlZC6oLmgpJCP0EGgEW/Wr5hfbA9E70P/V296/6if6OAkcGQgklC7YL5QrKCKUF1QHO/Qn6+fb69Ej0+vT59gn6zv3VAaUFygjlCrYLJQtCCUcGjgKJ/q/6dvc/9U70wPSF9mr5Fv0aAf0ESQiaCqoLWQuxCeMGRANE/1n7+/eP9WD0kfQc9tL4YfxeAFAEvwdECpMLggsWCngH+AMAAAj8iPjq9X70bfS89UH4sPui/58DLgfkCW8LoAtxCgUIpwS8ALz8HflP9qf0VvRm9bf3A/vm/uoClgZ7CUALsgvBCooIUQV3AXL9ufm+9tv0SvQb9Tb3W/or/jIC9wUHCQYLuAsGCwcJ9wUyAiv+W/o29xv1SvTb9L72ufly/XcBUQWKCMEKsgtAC3sJlgbqAub+A/u392b1VvSn9E/2Hfm8/LwApwQFCHEKoAtvC+QJLgefA6L/sPtB+Lz1bfR+9Or1iPgI/AAA+AN4BxYKgguTC0QKvwdQBF4AYfzS+Bz2kfRg9I/1+/dZ+0T/RAPjBrEJWQuqC5oKSQj9BBoBFv1q+YX2wPRO9D/1dvev+on+jgJHBkIJJQu2C+UKygilBdUBzv0J+vn2+vRI9Pr0+fYJ+s791QGlBcoI5Qq2CyULQglHBo4Cif6v+nb3P/VO9MD0hfZq+Rb9GgH9BEkImgqqC1kLsQnjBkQDRP9Z+/v3j/Vg9JH0HPbS+GH8XgBQBL8HRAqTC4ILFgp4B/gDAAAI/Ij46vV+9G30vPVB+LD7ov+fAy4H5AlvC6ALcQoFCKcEvAC8/B35T/an9Fb0ZvW39wP75v7qApYGewlAC7ILwQqKCFEFdwFy/bn5vvbb9Er0G/U291v6K/4yAvcFBwkGC7gLBgsHCfcFMgIr/lv6Nvcb9Ur02/S+9rn5cv13AVEFigjBCrILQAt7CZYG6gLm/gP7t/dm9Vb0p/RP9h35vPy8AKcEBQhxCqALbwvkCS4HnwOi/7D7Qfi89W30fvTq9Yj4CPwAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCQ==";
    await loadDoc(
      page,
      `::: audio {#a1}\nsrc: ${wav}\n:::\n\n` +
        '::: flashcards {#d}\ncard: "perro" | "dog" | @a1\ncard: "gato" | "cat"\n:::\n',
    );
    const figure = page.locator("#the-doc figure.folio-flashcards");
    await figure.locator(".folio-fc-label").click();
    await figure
      .locator(".folio-inspector button", { hasText: "Study deck" })
      .click();
    await expect(figure.locator(".folio-fc-study")).toBeVisible();
    // Remember the audio figure's <audio> element across a study flip
    // (startStudy itself re-renders once - that is fine; the point is
    // that keypresses after that do NOT tear the document down).
    const audioId = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const a = root?.querySelector("figure.folio-audio audio");
      if (a) (a as unknown as { __sentinel: boolean }).__sentinel = true;
      return !!a;
    });
    expect(audioId).toBe(true);
    await page.keyboard.press("Space");
    await expect(figure.locator(".folio-fc-study .fc-srs button")).toHaveCount(
      4,
    );
    // The same <audio> element is still in the DOM (not torn down).
    const stillThere = await page.evaluate(() => {
      const root = document.querySelector("folio-doc")?.shadowRoot;
      const a = root?.querySelector("figure.folio-audio audio") as
        (HTMLAudioElement & { __sentinel?: boolean }) | null;
      return !!a?.__sentinel && a.isConnected;
    });
    expect(stillThere).toBe(true);
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
