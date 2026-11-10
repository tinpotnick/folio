import { expect, test, type Page } from "@playwright/test";

/**
 * "Open with folio" on the web (File Handling API; spec:
 * docs/specs/web-files.md): the OS launches the installed app with a
 * .md file, delivered to the page through window.launchQueue. The
 * queue is stubbed here: the page sees a launch with notes.md, and a
 * fake disk that records writes.
 */
async function webLaunchedWith(page: Page, file: string | null): Promise<void> {
  await page.addInitScript((launch) => {
    const w = window as unknown as Record<string, unknown> & {
      __writes: string[];
      __launch: (text: string) => void;
    };
    w.__writes = [];
    const makeHandle = (text: string) => ({
      name: "notes.md",
      kind: "file",
      getFile: async () => new File([text], "notes.md"),
      queryPermission: async () => "granted",
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
    });
    let consumer: ((p: { files: unknown[] }) => void) | null = null;
    // window.launchQueue is a read-only accessor in Chromium: a plain
    // assignment silently fails and the stub never installs. Define an
    // own property over it instead.
    Object.defineProperty(window, "launchQueue", {
      configurable: true,
      value: {
        setConsumer: (cb: (p: { files: unknown[] }) => void) => {
          consumer = cb;
          if (launch !== null) {
            // The launch that started the app, delivered while the page
            // boots (deterministically, before boot's next-tick settle).
            cb({ files: [makeHandle(launch)] });
          }
        },
      },
    });
    // A launch on the RUNNING app, fired by the test.
    w.__launch = (text: string) => consumer?.({ files: [makeHandle(text)] });
  }, file);
}

test("launched with a file, the web app opens it; Save writes back to it", async ({
  page,
}) => {
  await webLaunchedWith(page, "# Notes\n\nFrom the file manager.\n");
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
        () => (window as unknown as { __writes: string[] }).__writes,
      ),
    )
    .toHaveLength(1);
  const writes = await page.evaluate(
    () => (window as unknown as { __writes: string[] }).__writes,
  );
  expect(writes[0]).toContain("From the file manager. Edited.");
});

test("launched without a file, the web app starts as usual", async ({
  page,
}) => {
  await webLaunchedWith(page, null);
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText(
    "Welcome to folio",
  );
});

test("a file opened while the app runs replaces the document", async ({
  page,
}) => {
  await webLaunchedWith(page, null);
  await page.goto("/");
  await expect(page.locator("#the-doc h1").first()).toHaveText(
    "Welcome to folio",
  );
  await page.evaluate(() =>
    (window as unknown as { __launch: (t: string) => void }).__launch(
      "# Later\n\nOpened while running.\n",
    ),
  );
  await expect(page.locator("#the-doc h1").first()).toHaveText("Later");
});
