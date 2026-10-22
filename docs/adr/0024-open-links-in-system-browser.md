# ADR-0024: Outside links open in the system browser

Date: 2026-10-22

Status: accepted

## Context

A link to the web (in a document, or in the help: graphviz.org,
strudel.cc, ...) opened a new tab on the web host. In the desktop
app `window.open` does nothing useful: the Tauri webview has no
tabs, and it must never navigate away from the user's document.
Tauri v2 moved "open in the system browser" out of its core into a
first-party plugin.

## Decision

- Add **tauri-plugin-opener** (2.x; MIT/Apache-2.0, maintained by the
  Tauri team, like tauri-plugin-dialog which folio already uses).
  Rust only: no JavaScript package and no webview permission.
- The shell exposes one command, `open_external(url)`, which accepts
  only `http://`, `https://` and `mailto:` addresses (unit-tested in
  `lib.rs`) and hands them to the platform's default browser or
  mail app. `file:`, `javascript:` and custom schemes are refused:
  a document must not be able to run or read anything on the
  machine by being clicked.
- The page calls it through `openExternal()` in `src/desktop.ts`;
  on the web the same links still open a new tab.

## Consequences

- One more Rust crate in the desktop build; the web bundle is
  unchanged.
- Restart `tauri dev` after pulling (a new plugin and command).
