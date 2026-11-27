import { rmSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The service worker (spec: docs/specs/web-files.md): documents are
 * NETWORK-FIRST with the cache as the offline fallback. A cache-first
 * worker froze installed apps at their first-opened snapshot, so the
 * nightly-refreshed stats example never reached them. The hashed app
 * shell stays cache-first (immutable).
 *
 * Uses a throwaway document in public/ (vite serves it) rather than a
 * real example, so no test ever sees the server's file change under it.
 */
const DOC = "sw-fresh.md";

async function registerWorker(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    // the worker claims the page on activate; give it a beat
    await new Promise((r) => setTimeout(r, 200));
    if (!reg.active) throw new Error("service worker never activated");
  });
}

test("documents revalidate: a nightly-refreshed doc reaches an installed app", async ({
  page,
}) => {
  writeFileSync(`public/${DOC}`, "seed snapshot\n");
  try {
    await page.goto("/");
    await registerWorker(page);
    const get = () =>
      page.evaluate(
        (u) => fetch(u, { cache: "reload" }).then((r) => r.text()),
        DOC,
      );
    expect(await get()).toContain("seed snapshot");
    // The nightly redeploy changes the server's copy...
    writeFileSync(`public/${DOC}`, "nightly snapshot\n");
    // ...and the app must see it despite the cached copy (regression:
    // cache-first served the frozen seed forever).
    expect(await get()).toContain("nightly snapshot");
  } finally {
    rmSync(`public/${DOC}`);
  }
});

test("offline: the cached copy serves (the installed app works offline)", async ({
  page,
  context,
}) => {
  writeFileSync(`public/${DOC}`, "seed snapshot\n");
  try {
    await page.goto("/");
    await registerWorker(page);
    // prime the document cache (network-first caches on success)
    expect(
      await page.evaluate((u) => fetch(u).then((r) => r.text()), DOC),
    ).toContain("seed snapshot");
    await context.setOffline(true);
    const got = await page.evaluate((u) => fetch(u).then((r) => r.text()), DOC);
    expect(got).toContain("seed snapshot");
    await context.setOffline(false);
  } finally {
    rmSync(`public/${DOC}`);
  }
});
