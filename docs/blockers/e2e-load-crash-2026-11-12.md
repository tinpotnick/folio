# Blocker/incident: two hard machine crashes during e2e work (2026-11-12)

## What happened

While developing bundled proofing (ADR-0033, spell + grammar), the laptop
froze hard twice and had to be power-cycled:

- boot ended 2026-11-12 11:45:54 (session started 08:53)
- boot ended 2026-11-12 12:14:26 (session started 11:48)

## Forensics (journalctl / coredumpctl, no kernel MCEs)

In the 11:48-12:14 boot, between 11:51:51 and 11:54:26:

- 5x `node-22` core dumps - SIGSEGV/SIGILL; the vite dev server
  (`npm run dev`) crashed inside llhttp's `on_headers_complete`, another
  node crashed in V8 `Function` dynamic compilation.
- 4-5x `chrome-headless-shell` (Playwright's browser) core dumps,
  SIGSEGV `SI_KERNEL` / SIGILL in renderer threads.

Pattern: many unrelated V8-based processes aborting at once = resource
exhaustion under load, not a single code path. At the time, a full
`playwright test` run defaulted to 7 workers (half of 14 cores) with
`fullyParallel: true`, each worker's headless Chromium loading the app
plus heavy assets (pyodide for compute tests, the 20 MB harper wasm for
the grammar test, the 550 KB spell dictionary) while all of them
hammered one vite dev server. gnome-shell then logged "Timeout was
reached" creating scopes - the whole desktop was starved - and the
machine died at 12:14:26. No OOM-killer entries; the aborts are the
V8/glibc OOM/CHECK handlers in over-committed processes.

After the incident, the same tree was re-run under a watchdog
(memory + per-process RSS): full unit suite 439/439 in 3 s, build OK
(26.7 s), proofing e2e 4/4, full e2e 616 passed with 6 load flakes at
7 workers, 0 crashes, memory never below 49 GB available; the 4 flaky
spec files re-run at 2 workers: 159/159 pass.

## Mitigations (this change)

- `playwright.config.ts` caps `workers` (PW_WORKERS override; 4 local,
  2 on CI) instead of defaulting to cores/2.
- `src/component.ts` serializes proofing mark passes (`runMarks`
  guard): a pass scheduled while another is awaiting the dictionary or
  the grammar wasm no longer runs concurrently - concurrent passes
  interleave unwrap/rewrap and can nest mark spans / scramble
  `grammarHits` indices. Regression test in `tests/e2e/proofing.spec.ts`.

## Still open

The exact V8 abort in node (llhttp / dynamic Function) is not
reproduced in isolation; if the machine crashes again, capture
`coredumpctl info <pid>` and `journalctl -b <n> -p err` immediately -
watch for simultaneous SIGILL in node and chrome-headless-shell.
