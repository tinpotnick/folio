import { expect, test } from "@playwright/test";

/**
 * Links in the help (spec: docs/specs/links.md): they open outside
 * folio like the document's own links - a new tab on the web. They
 * did nothing: only the document listened for its links.
 */
test("a link in the help opens in a new tab", async ({ page, context }) => {
  // Never leave the machine: answer the outside site locally.
  await context.route("https://graphviz.org/**", (route) =>
    route.fulfill({
      body: "<title>Graphviz</title>",
      contentType: "text/html",
    }),
  );
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
  await page.locator("#btn-help").click();
  await page
    .locator("#help-doc a", { hasText: "Diagrams and drawings" })
    .click();
  const link = page.locator("#help-doc a", { hasText: "Graphviz" }).first();
  await link.scrollIntoViewIfNeeded();
  const [tab] = await Promise.all([context.waitForEvent("page"), link.click()]);
  expect(tab.url()).toContain("graphviz.org");
  // The document is untouched.
  await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
});

test("Support folio opens Buy Me a Coffee in a new tab", async ({
  page,
  context,
}) => {
  await context.route("https://buymeacoffee.com/**", (route) =>
    route.fulfill({
      body: "<title>Buy Me a Coffee</title>",
      contentType: "text/html",
    }),
  );
  await page.goto("/?doc=demo/examples/poem.md");
  await page.locator("#the-doc h1").first().waitFor();
  await page.keyboard.press("Control+k");
  // "coffee" alone also names the Coffee forecast example (a title
  // word); the phrase a supporter types finds this first.
  await page.locator("#palette-input").fill("buy me a coffee");
  await expect(
    page.locator("#palette-list .palette-item").first(),
  ).toContainText("Support folio");
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.keyboard.press("Enter"),
  ]);
  expect(tab.url()).toBe("https://buymeacoffee.com/tinpotnick");
});
