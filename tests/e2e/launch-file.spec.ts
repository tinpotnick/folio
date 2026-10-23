import { expect, test, type Page } from "@playwright/test";

/**
 * Opening a .md file with folio (spec: docs/specs/desktop-tauri-host.md,
 * "Open with"): the desktop app launched with a file shows that file -
 * not the blank page or the guide - and Save writes back to it. The
 * Tauri bridge is stubbed: the page sees a desktop host launched with
 * notes.md.
 */
async function desktopLaunchedWith(
  page: Page,
  file: string | null,
): Promise<void> {
  await page.addInitScript((launch) => {
    const saved: unknown[] = [];
    let callbacks = 0;
    const w = window as unknown as Record<string, unknown>;
    w.__saved = saved;
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => (callbacks += 1),
      invoke: async (cmd: string, args: Record<string, unknown>) => {
        if (cmd === "launch_document") {
          const once = launch;
          launch = null;
          return once ? { path: "/home/n/notes.md", text: once } : null;
        }
        if (cmd === "save_document") {
          saved.push(args);
          return "/home/n/notes.md";
        }
        return null;
      },
    };
  }, file);
}

test("launched with a file, folio opens it; Save writes back to it", async ({
  page,
}) => {
  await desktopLaunchedWith(page, "# Notes\n\nFrom the file manager.\n");
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText("Notes");
  await expect(page).toHaveTitle("Notes — folio");
  await page.locator("#the-doc p").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited.");
  await page.keyboard.press("Control+s");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __saved: { current: string }[] }).__saved,
      ),
    )
    .toHaveLength(1);
  const saved = await page.evaluate(
    () =>
      (window as unknown as { __saved: { current: string; text: string }[] })
        .__saved[0],
  );
  expect(saved?.current).toBe("/home/n/notes.md");
  expect(saved?.text).toContain("From the file manager. Edited.");
});

test("launched without a file, folio starts as usual", async ({ page }) => {
  await desktopLaunchedWith(page, null);
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText(
    "Welcome to folio",
  );
});
