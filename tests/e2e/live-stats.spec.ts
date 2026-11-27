import { expect, test } from "@playwright/test";

/**
 * The stats example has a fresher live copy on the site (spec:
 * docs/specs/package-repos.md, "Counting downloads"): the bundled file
 * is a seed frozen at build time, so opening it fetches the latest
 * snapshot when online (4 s timeout), falling back to the bundled
 * seed offline or on error.
 */
const LIVE = "https://tinpotnick.github.io/folio/demo/examples/stats.md";

test("opens the latest live snapshot when online", async ({ page }) => {
  // a table block: the live fetch sanity-checks that the response
  // looks like the stats document, not an error page
  await page.route(LIVE, (r) =>
    r.fulfill({
      body: "# LIVE SNAPSHOT MARKER\n\n::: table {#t}\ndata:\n:::\n",
    }),
  );
  await page.goto("/?doc=demo/examples/stats.md");
  await expect(page.locator("#the-doc h1")).toHaveText("LIVE SNAPSHOT MARKER");
});

test("falls back to the bundled seed when the live copy is unreachable", async ({
  page,
}) => {
  await page.route(LIVE, (r) => r.abort());
  await page.goto("/?doc=demo/examples/stats.md");
  await expect(page.locator("#the-doc h1")).toHaveText("folio's own numbers");
});
