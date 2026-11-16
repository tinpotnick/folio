import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the demo host page (ADR-0006: the host app
 * around `<folio-doc>`). They run against the Vite dev server, so no
 * Tauri shell is involved — the Tauri-only Open/Save buttons are
 * asserted in their hidden (web) state, per docs/specs/desktop-tauri-host.md.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Cap parallelism: the default (half the cores) spawned 7 headless
  // Chromiums at once on a 14-core laptop, and each of them loads the
  // app plus heavy assets (pyodide, the 20 MB grammar wasm, the spell
  // dictionary) while hammering the dev server - that load storm
  // crashed renderers and the dev server and froze the machine (two
  // hard crashes on 2026-11-12; see docs/blockers/). 4 workers locally
  // (override with PW_WORKERS), 2 on CI runners.
  workers: Number(process.env.PW_WORKERS ?? (process.env.CI ? 2 : 4)),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The microphone tests record for real: a fake input
        // device auto-granted permission keeps them headless.
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
