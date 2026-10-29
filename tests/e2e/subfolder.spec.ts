import { expect, test } from "@playwright/test";

/**
 * Shipped documents are addressed relative to the app's page, so one
 * build serves from "/", from a subfolder (GitHub Pages: /folio/) and
 * inside the desktop app. Absolute "/demo/..." paths broke under a
 * subfolder.
 */
test("shipped documents load by app-relative paths", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/demo/")) fetched.push(new URL(r.url()).pathname);
  });
  await page.goto("/?doc=demo/examples/poem.md");
  await expect(page.locator("#the-doc h1").first()).toHaveText("Ozymandias");
  await page.locator("#btn-help").click();
  await expect(page.locator("#help-doc h1").first()).toHaveText("folio help");
  expect(fetched).toContain("/demo/examples/poem.md");
  expect(fetched).toContain("/demo/help/index.md");
  // The address keeps the app-relative form.
  expect(page.url()).toContain("?doc=demo/examples/poem.md");
});
