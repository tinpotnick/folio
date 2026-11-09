import { expect, test, type Page } from "@playwright/test";

/**
 * "Open .md files with folio by default" (command palette; spec:
 * docs/specs/desktop-tauri-host.md, "Open with folio"): a desktop-only
 * command that asks the shell to make folio the OS default for .md.
 * The Tauri bridge is stubbed; on plain web the entry does not exist.
 */
async function desktopShell(page: Page, message: string): Promise<void> {
  await page.addInitScript((msg) => {
    const w = window as unknown as Record<string, unknown> & {
      __cmds: string[];
    };
    w.__cmds = [];
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (cmd: string) => {
        w.__cmds.push(cmd);
        return cmd === "set_default_md_handler" ? msg : null;
      },
    };
  }, message);
}

test("palette entry asks the shell to set the .md default; the answer flashes", async ({
  page,
}) => {
  await desktopShell(page, "md default set by the shell");
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("#palette-input").fill("folio by default");
  const entry = page.locator("#palette-list .palette-item", {
    hasText: "Open .md files with folio by default",
  });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.locator("#palette-modal")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __cmds: string[] }).__cmds),
    )
    .toContain("set_default_md_handler");
  await expect(page.locator("#status")).toContainText(
    "md default set by the shell",
  );
});

test("on the web there is no such palette entry", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("#palette-input").fill("folio by default");
  await expect(
    page.locator("#palette-list .palette-item", {
      hasText: "Open .md files with folio by default",
    }),
  ).toHaveCount(0);
});
