import { expect, test, type Page } from "@playwright/test";

/**
 * Save-time conflict detection (spec: docs/specs/save-conflicts.md):
 * a file changed on disk since the last load/save is merged on save,
 * not clobbered. The Tauri bridge is stubbed with a virtual file
 * system, as in desktop-save.spec.ts.
 */

const PATH = "/tmp/picked/report.md";

interface VFile {
  text: string;
  mtimeMs: number;
}

type StubWindow = {
  __files: Record<string, VFile>;
  __cmds: { cmd: string; args: Record<string, unknown> }[];
  __TAURI_INTERNALS__: unknown;
};

async function desktopShell(page: Page): Promise<void> {
  await page.addInitScript((path) => {
    const w = window as unknown as StubWindow;
    w.__files = {};
    w.__cmds = [];
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (cmd: string, args: Record<string, unknown>) => {
        w.__cmds.push({ cmd, args });
        if (cmd === "save_document") {
          w.__files[path] = { text: String(args.text), mtimeMs: 1000 };
          return path;
        }
        if (cmd === "write_document") {
          const f = w.__files[String(args.path)];
          if (!f) throw new Error("file gone");
          f.text = String(args.text);
          f.mtimeMs += 1;
          return null;
        }
        if (cmd === "stat_document") {
          const f = w.__files[String(args.path)];
          return f ? { mtimeMs: f.mtimeMs, size: f.text.length } : null;
        }
        if (cmd === "read_document") {
          const f = w.__files[String(args.path)];
          if (!f) throw new Error("file gone");
          return f.text;
        }
        return null;
      },
    };
  }, PATH);
}

/** Change the file "externally" between folio's load/save. */
async function externalEdit(page: Page, text: string): Promise<void> {
  await page.evaluate(
    ({ path, text: t }) => {
      const w = window as unknown as StubWindow;
      const f = w.__files[path];
      if (!f) throw new Error("no file");
      f.text = t;
      f.mtimeMs += 100;
    },
    { path: PATH, text },
  );
}

async function setDoc(page: Page, md: string): Promise<void> {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>("#btn-markdown")?.click(),
  );
  await page.locator("#editor").fill(md);
}

/** Click Save and wait until one more write reached the virtual file. */
async function save(page: Page): Promise<void> {
  const before = await page.evaluate(
    () =>
      (window as unknown as StubWindow).__cmds.filter(
        (c) => c.cmd === "save_document" || c.cmd === "write_document",
      ).length,
  );
  await page.locator("#btn-save").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as StubWindow).__cmds.filter(
            (c) => c.cmd === "save_document" || c.cmd === "write_document",
          ).length,
      ),
    )
    .toBe(before + 1);
}

async function writtenText(page: Page): Promise<string> {
  return page.evaluate(
    ({ path }) => {
      const w = window as unknown as StubWindow;
      const f = w.__files[path];
      return f ? f.text : "";
    },
    { path: PATH },
  );
}

async function cmds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as StubWindow).__cmds.map((c) => c.cmd),
  );
}

test.describe("save-time conflict detection", () => {
  test("external change + local edit in separated places: clean merge, both kept", async ({
    page,
  }) => {
    await desktopShell(page);
    await page.goto("/");
    await setDoc(page, "# T\n\npara one\n\npara two\n");
    await save(page); // first save: save_document dialog stub, path set
    // External appends at the end; locally the first paragraph is
    // edited - separated by unchanged lines, so this merges cleanly.
    await externalEdit(page, "# T\n\npara one\n\npara two\n\nappended\n");
    await setDoc(page, "# T\n\nONE edited\n\npara two\n");
    await save(page);
    await expect(page.locator("#status")).toContainText("Merged");
    const text = await writtenText(page);
    expect(text).toContain("ONE edited");
    expect(text).toContain("appended");
  });

  test("conflicting hunk: the modal asks; Overwrite keeps only ours", async ({
    page,
  }) => {
    await desktopShell(page);
    await page.goto("/");
    await setDoc(page, "# T\n\nsame line\n");
    await save(page);
    await externalEdit(page, "# T\n\nexternal edit\n");
    await setDoc(page, "# T\n\nlocal edit\n");
    await page.locator("#btn-save").click();
    const modal = page.locator("#save-conflict-modal");
    await expect(modal).toBeVisible();
    await expect(
      page.locator("#save-conflict-list .conflict-hunk"),
    ).toHaveCount(1);
    await page.locator("#btn-conflict-overwrite").click();
    await expect(modal).toBeHidden();
    const text = await writtenText(page);
    expect(text).toContain("local edit");
    expect(text).not.toContain("external edit");
  });

  test("conflicting hunk: Save merged with theirs picked writes theirs", async ({
    page,
  }) => {
    await desktopShell(page);
    await page.goto("/");
    await setDoc(page, "# T\n\nsame line\n");
    await save(page);
    await externalEdit(page, "# T\n\nexternal edit\n");
    await setDoc(page, "# T\n\nlocal edit\n");
    await page.locator("#btn-save").click();
    await expect(page.locator("#save-conflict-modal")).toBeVisible();
    await page
      .locator('#save-conflict-list input[name="conflict-0"][value="theirs"]')
      .check();
    await page.locator("#btn-conflict-merge").click();
    await expect(page.locator("#save-conflict-modal")).toBeHidden();
    const text = await writtenText(page);
    expect(text).toContain("external edit");
    expect(text).not.toContain("local edit");
  });

  test("Cancel writes nothing; unchanged stat skips the read entirely", async ({
    page,
  }) => {
    await desktopShell(page);
    await page.goto("/");
    await setDoc(page, "# T\n\nfirst\n");
    await save(page);
    const before = await cmds(page);
    // No external change: the second save must not even read the file.
    await setDoc(page, "# T\n\nsecond\n");
    await save(page);
    const after = await cmds(page);
    expect(after.slice(before.length)).not.toContain("read_document");
    expect(await writtenText(page)).toContain("second");
    // Now an external change and Cancel: nothing written.
    await externalEdit(page, "# T\n\nsecond\nchanged outside\n");
    await setDoc(page, "# T\n\nsecond\nchanged inside\n");
    await page.locator("#btn-save").click();
    await expect(page.locator("#save-conflict-modal")).toBeVisible();
    await page.locator("#btn-conflict-cancel").click();
    await expect(page.locator("#save-conflict-modal")).toBeHidden();
    expect(await writtenText(page)).toContain("changed outside");
    expect(await writtenText(page)).not.toContain("changed inside");
  });
});
