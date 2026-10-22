import { expect, test, type Page } from "@playwright/test";
import { serveStrudelLocally } from "./strudel-player";

/**
 * The Strudel player is an add-on (ADR-0026, spec:
 * docs/specs/strudel-blocks.md): folio's builds do not contain it
 * (AGPL); the first Play asks, then downloads a hash-pinned release
 * once and keeps it.
 */

async function loadPattern(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("folio-doc h1").first().waitFor();
  await page.locator("#btn-markdown").click();
  await page
    .locator("#editor")
    .fill('# T\n\n```strudel\nsound("bd hh sd hh")\n```\n');
  await page.locator("#btn-view").click();
  await page.locator("#the-doc figure.folio-strudel").click();
}

const play = (page: Page) => page.locator("#the-doc .strudel-play");
const addon = (page: Page) => page.locator("#the-doc .strudel-addon");

test("the first Play asks; Not now downloads nothing", async ({
  page,
  context,
}) => {
  const asked = await serveStrudelLocally(context);
  await loadPattern(page);
  await play(page).click();
  await expect(addon(page)).toBeVisible();
  await expect(addon(page)).toContainText("AGPL-3.0");
  await page.locator("#the-doc .addon-later").click();
  await expect(addon(page)).toBeHidden();
  expect(asked).toEqual([]);
});

test("Install and play downloads it once, and it is kept", async ({
  page,
  context,
}) => {
  const asked = await serveStrudelLocally(context);
  await loadPattern(page);
  await play(page).click();
  await page.locator("#the-doc .addon-install").click();
  await expect(play(page)).toContainText("Playing", { timeout: 15_000 });
  await expect(page.locator("#the-doc .strudel-error")).toBeHidden();
  expect(asked).toHaveLength(2);
  // Another day: it plays straight away, with nothing downloaded.
  await page.locator("#the-doc .strudel-stop").click();
  asked.length = 0;
  await loadPattern(page);
  await play(page).click();
  await expect(addon(page)).toBeHidden();
  await expect(play(page)).toContainText("Playing", { timeout: 15_000 });
  expect(asked).toEqual([]);
});

test("a download that is not the pinned release is refused", async ({
  page,
  context,
}) => {
  await serveStrudelLocally(context, true);
  await loadPattern(page);
  await play(page).click();
  await page.locator("#the-doc .addon-install").click();
  await expect(page.locator("#the-doc .strudel-error")).toContainText(
    "did not match the expected release",
  );
  await expect(play(page)).not.toContainText("Playing");
});
