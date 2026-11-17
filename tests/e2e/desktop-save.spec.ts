import { expect, test, type Page } from "@playwright/test";

/**
 * Desktop Save (spec: docs/specs/desktop-tauri-host.md): once the app
 * knows the open file, Save writes straight back to it (the
 * `write_document` command, no dialog); the dialog (`save_document`)
 * is only the first save or an explicit Save As. The Tauri bridge is
 * stubbed, as in default-md.spec.ts.
 */
async function desktopShell(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & {
      __cmds: { cmd: string; args: unknown }[];
    };
    w.__cmds = [];
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (cmd: string, args: unknown) => {
        w.__cmds.push({ cmd, args });
        if (cmd === "save_document") return "/tmp/picked/report.md";
        return null; // write_document, launch_document, event listen, ...
      },
    };
  });
}

/** The save-related shell commands, in order. */
function saveCmds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as { __cmds: { cmd: string }[] }).__cmds
      .map((c) => c.cmd)
      .filter((c) => c === "save_document" || c === "write_document"),
  );
}

test("Save writes straight back to the known file - no second dialog; Save As uses the dialog", async ({
  page,
}) => {
  await desktopShell(page);
  await page.goto("/");

  // in-memory doc, no path yet: the first Save goes through the dialog
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill("# T\n\nfirst save");
  await page.locator("#btn-save").click();
  await expect(page.locator("#status")).toContainText(
    "Saved /tmp/picked/report.md",
  );
  await expect.poll(() => saveCmds(page)).toEqual(["save_document"]);

  // edit and Save again: write_document straight to that path
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill("# T\n\nsecond save");
  await page.locator("#btn-save").click();
  await expect(page.locator("#status")).toContainText(
    "Saved /tmp/picked/report.md",
  );
  await expect
    .poll(() => saveCmds(page))
    .toEqual(["save_document", "write_document"]);
  const writeArgs = await page.evaluate(() => {
    const c = (
      window as unknown as { __cmds: { cmd: string; args: never }[] }
    ).__cmds.find((c) => c.cmd === "write_document");
    return c ? c.args : null;
  });
  expect(writeArgs).toEqual({
    path: "/tmp/picked/report.md",
    text: expect.stringContaining("second save"),
  });

  // explicit Save As from the palette: the dialog again
  await page.keyboard.press("Control+k");
  await page.locator("#palette-input").fill("save as");
  const entry = page.locator("#palette-list .palette-item", {
    hasText: "Save the document as...",
  });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect
    .poll(() => saveCmds(page))
    .toEqual(["save_document", "write_document", "save_document"]);
});

test("on the web there is no Save As palette entry", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("#palette-input").fill("save as");
  await expect(
    page.locator("#palette-list .palette-item", {
      hasText: "Save the document as...",
    }),
  ).toHaveCount(0);
});
