import { rmSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The service worker (spec: docs/specs/web-files.md): documents are
 * NETWORK-FIRST with the cache as the offline fallback. A cache-first
 * worker froze installed apps at their first-opened snapshot, so the
 * nightly-refreshed stats example never reached them. The hashed app
 * shell stays cache-first (immutable).
 *
 * Uses throwaway documents in public/ (vite serves them) rather than a
 * real example, so no test ever sees the server's file change under
 * it. Each test owns its own file: workers run in parallel.
 */
async function registerWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("sw.js");
    // clients.claim() on activate is what puts the worker in control;
    // poll for it instead of sleeping a fixed beat
    const deadline = performance.now() + 10_000;
    while (
      navigator.serviceWorker.controller === null &&
      performance.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!navigator.serviceWorker.controller)
      throw new Error("service worker never took control");
  });
}

test("documents revalidate: a nightly-refreshed doc reaches an installed app", async ({
  page,
}) => {
  const doc = "sw-fresh-revalidate.md";
  writeFileSync(`public/${doc}`, "seed snapshot\n");
  try {
    await page.goto("/");
    await registerWorker(page);
    const get = () =>
      page.evaluate(
        (u) => fetch(u, { cache: "reload" }).then((r) => r.text()),
        doc,
      );
    expect(await get()).toContain("seed snapshot");
    // The nightly redeploy changes the server's copy...
    writeFileSync(`public/${doc}`, "nightly snapshot\n");
    // ...and the app must see it despite the cached copy (regression:
    // cache-first served the frozen seed forever).
    expect(await get()).toContain("nightly snapshot");
  } finally {
    rmSync(`public/${doc}`, { force: true });
  }
});

test("offline: the cached copy serves (the installed app works offline)", async ({
  page,
  context,
}) => {
  const doc = "sw-fresh-offline.md";
  writeFileSync(`public/${doc}`, "seed snapshot\n");
  try {
    await page.goto("/");
    await registerWorker(page);
    // prime the document cache (network-first caches on success)
    expect(
      await page.evaluate((u) => fetch(u).then((r) => r.text()), doc),
    ).toContain("seed snapshot");
    // the SW's cache put races its response; let it settle before
    // going offline (the fetch handler does not await its own put)
    await page.waitForTimeout(500);
    await context.setOffline(true);
    const got = await page.evaluate((u) => fetch(u).then((r) => r.text()), doc);
    expect(got).toContain("seed snapshot");
    await context.setOffline(false);
  } finally {
    rmSync(`public/${doc}`, { force: true });
  }
});
