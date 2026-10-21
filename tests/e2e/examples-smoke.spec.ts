import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Every shipped example opens and draws without a single error: no
 * chart, model, drawing, music or table error anywhere. A broken
 * example is the first thing a new user meets.
 */
const examples = readdirSync("demo/examples").filter((f) => f.endsWith(".md"));

for (const file of examples) {
  test(`example ${file} draws with no errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.goto(`/?doc=demo/examples/${file}`);
    await page.locator("#the-doc h1").first().waitFor();
    // Drawn figures load lazily: wait until none is still "Drawing…".
    await expect
      .poll(
        () =>
          page.locator("#the-doc").evaluate((host) => {
            const root = host.shadowRoot as ShadowRoot;
            return Array.from(
              root.querySelectorAll(".code-view, .chart-holder"),
            ).filter((v) =>
              /^(Drawing…|Building the model…)$/.test(
                (v.textContent ?? "").trim(),
              ),
            ).length;
          }),
        { timeout: 20_000 },
      )
      .toBe(0);
    const errors = await page.locator("#the-doc").evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      return [
        ...Array.from(
          root.querySelectorAll(
            ".drawn-error, .jscad-error, .folio-table-error",
          ),
        ).map((e) => e.textContent ?? ""),
        ...Array.from(root.querySelectorAll(".chart-holder"))
          .map((h) => h.textContent ?? "")
          .filter((t) => t.includes("Chart error")),
      ];
    });
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
