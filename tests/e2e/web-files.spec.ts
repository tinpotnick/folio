import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** Open, Save and the unsaved draft on the web (spec:
 * docs/specs/web-files.md). */

const DOC = "# Plan\n\nFirst draft.\n";

/** A later launch: the guide has been seen, so a bare URL is a blank
 * document (or the restored draft). */
async function laterLaunch(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("folio.guided", "1"));
}

/** Firefox / Safari: no File System Access API. */
async function noRealFiles(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.showOpenFilePicker;
    delete w.showSaveFilePicker;
  });
}

/** Chrome / Edge: real files, here a fake disk that records writes. */
async function fakeDisk(page: Page, initial: string): Promise<void> {
  await page.addInitScript((text) => {
    const w = window as unknown as Record<string, unknown> & {
      __writes: string[];
      __pickers: number;
    };
    w.__writes = [];
    w.__pickers = 0;
    const handle = {
      name: "plan.md",
      kind: "file",
      getFile: async () => new File([text], "plan.md"),
      createWritable: async () => {
        let buf = "";
        return {
          write: async (d: string) => {
            buf += d;
          },
          close: async () => {
            w.__writes.push(buf);
          },
        };
      },
    };
    w.showOpenFilePicker = async () => {
      w.__pickers += 1;
      return [handle];
    };
    w.showSaveFilePicker = async () => {
      w.__pickers += 1;
      return handle;
    };
  }, initial);
}

test("without real files: Open uploads, Save downloads the .md", async ({
  page,
}) => {
  await laterLaunch(page);
  await noRealFiles(page);
  await page.goto("/");
  await page.locator("#the-doc h1").first().waitFor();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#btn-open").click(),
  ]);
  await chooser.setFiles({
    name: "plan.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(DOC),
  });
  await expect(page.locator("#the-doc h1").first()).toHaveText("Plan");
  await page.locator("#the-doc p").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited.");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Control+s"),
  ]);
  expect(download.suggestedFilename()).toBe("plan.md");
  expect(readFileSync(await download.path(), "utf8")).toContain(
    "First draft. Edited.",
  );
  await expect(page.locator("#btn-save")).toHaveAttribute("title", /downloads/);
});

test("with real files: Save writes back to the same file", async ({ page }) => {
  await laterLaunch(page);
  await fakeDisk(page, DOC);
  await page.goto("/");
  await page.locator("#the-doc h1").first().waitFor();
  await page.keyboard.press("Control+o");
  await expect(page.locator("#the-doc h1").first()).toHaveText("Plan");
  await page.locator("#the-doc p").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited.");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#status")).toContainText("Saved plan.md");
  const disk = await page.evaluate(() => {
    const w = window as unknown as { __writes: string[]; __pickers: number };
    return { writes: w.__writes, pickers: w.__pickers };
  });
  // One picker (Open); Save went straight back to the file.
  expect(disk.pickers).toBe(1);
  expect(disk.writes.at(-1)).toContain("First draft. Edited.");
});

test("unsaved work survives closing the tab, until it is saved", async ({
  page,
}) => {
  await laterLaunch(page);
  await noRealFiles(page);
  await page.goto("/");
  await page.locator("#the-doc h1").first().waitFor();
  await page.keyboard.type("Notes for Monday");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Remember the budget.");
  await page.waitForTimeout(900); // the draft is kept after a pause
  // Close and come back.
  page.once("dialog", (d) => void d.accept());
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText(
    "Notes for Monday",
  );
  await expect(page.locator("#status")).toContainText(
    "Restored your unsaved work",
  );
  // Saved: the next launch is a fresh page.
  await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Control+s"),
  ]);
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText("");
});

test("Discard throws the draft away; the dialog offers Save on the web", async ({
  page,
}) => {
  await laterLaunch(page);
  await page.goto("/");
  await page.locator("#the-doc h1").first().waitFor();
  await page.keyboard.type("Scratch");
  await page.waitForTimeout(900);
  await page.keyboard.press("Control+n");
  await expect(page.locator("#btn-unsaved-save")).toBeVisible();
  await page.locator("#btn-unsaved-discard").click();
  await expect(page.locator("#the-doc h1").first()).toHaveText("");
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText("");
});
