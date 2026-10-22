import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { STRUDEL_FILES, STRUDEL_VERSION } from "../../src/audio/strudel-addon";

/**
 * The Strudel player is an add-on (ADR-0026). Tests that are about
 * PLAYING start with it installed; tests about installing answer its
 * download address from the local package - never the internet.
 */

const dist = "node_modules/@strudel/web/dist/";
const files = Object.values(STRUDEL_FILES).map(
  (f) => [f.path, readFileSync(dist + f.path, "utf8")] as const,
);

/** Seed the kept copy, as if the user had installed it earlier. */
export async function withStrudelPlayer(page: Page): Promise<void> {
  await page.addInitScript(
    ({ entries }) => {
      const req = indexedDB.open("folio-addons", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => {
        const tx = req.result.transaction("files", "readwrite");
        for (const [k, v] of entries) tx.objectStore("files").put(v, k);
      };
    },
    {
      entries: files.map(
        ([path, text]) => [`strudel@${STRUDEL_VERSION}/${path}`, text] as const,
      ),
    },
  );
}

/** Answer the add-on's download address from the local package. */
export async function serveStrudelLocally(
  context: BrowserContext,
  tamper = false,
): Promise<string[]> {
  const asked: string[] = [];
  await context.route(
    `https://cdn.jsdelivr.net/npm/@strudel/web@${STRUDEL_VERSION}/dist/**`,
    (route) => {
      const url = route.request().url();
      asked.push(url);
      const hit = files.find(([path]) => url.endsWith(path));
      if (!hit) return route.fulfill({ status: 404 });
      return route.fulfill({
        body: tamper ? hit[1] + "\n// changed" : hit[1],
        contentType: "text/javascript",
      });
    },
  );
  return asked;
}
