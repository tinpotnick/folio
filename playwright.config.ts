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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
