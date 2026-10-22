# Unsaved changes

## Status: accepted (2026-10-21)

## Decision

Anything that REPLACES the open document asks first when the
document has unsaved changes. Before this, opening an example,
following a link, or pressing Back silently threw the edits away.

## Contract

- **Unsaved** means the current Markdown (from the document view or
  the source editor) differs from the document as of its last load
  or save, serialized. Undoing back to that state counts as clean;
  nothing is tracked per keystroke. The getting-started guide is
  never unsaved: it invites the reader to try its live table, so
  those edits are play, not work (2026-10-21).
- **What asks**: example and guide links, the folio wordmark,
  "Open example: ...", "Getting started guide" and "New document"
  (Ctrl+N) in the palette,
  Back/Forward (on Cancel, the address is put back), the desktop
  Open button, closing the desktop window, and closing or reloading
  the browser tab (the browser's own prompt). Settings Apply and
  imports change the document; they do not replace it, so they do
  not ask.
- **The dialog** (`#unsaved-modal`) says what would happen ("Opening
  another document replaces it."; "Starting a new document replaces
  it." for New document) and offers:
  - **Save...** (desktop only): the save dialog. Only a completed save
    goes ahead; cancelling it stays put.
  - **Discard changes**: goes ahead.
  - **Cancel** (or Esc): stays, with the document and address
    untouched.
- **Desktop window close**: Tauri's close request is intercepted
  while unsaved; after Save or Discard the window is destroyed
  (capability `core:window:allow-destroy`).
- A load or a save marks the document clean.

## Acceptance

- e2e: `tests/e2e/unsaved.spec.ts` (clean never asks; an edit asks,
  Save hidden on the web, Cancel keeps the edit and the URL; Discard
  goes ahead; undo back to clean does not ask; Back asks and Cancel
  restores the address; the palette's Open example asks; reload gets
  the browser's beforeunload prompt).
- WebKitGTK: `tests/webkitgtk/unsaved.js` (the wordmark asks; Cancel
  keeps the edit).
- First-contact eval: `evals/unsaved-changes-first-contact.md`.
