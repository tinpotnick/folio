# Web files and the unsaved draft

## Status: accepted (2026-10-22)

## Decision

The hosted web version opens and saves real documents, on the user's
own machine - nothing is uploaded. Unsaved work survives closing the
tab or the app. Cloud storage (Google Drive, OneDrive, Dropbox) is a
later, host-level addition; documents never depend on it to render.

## Contract

- **Open / Save** show on both hosts (`#btn-open`, `#btn-save`,
  palette "Open a document" / "Save the document", Ctrl+O / Ctrl+S).
  The desktop keeps its native dialogs (`src/desktop.ts`).
- **Web, File System Access** (`src/web-files.ts`; Chrome, Edge):
  Open uses `showOpenFilePicker` and keeps the handle; Save writes
  back to that handle without asking, or asks once with
  `showSaveFilePicker`. The flash says "Saved <name>".
- **Web, no File System Access** (Firefox, Safari): Open is the
  browser's file chooser; Save downloads `<name>.md` ("Downloaded
  <name>"); the Save button's tooltip says it downloads.
- **Suggested name**: the open file's, else the first H1, else
  "Untitled" (shared with Export as PDF).
- **The unsaved-changes dialog** offers Save on the web too.
- **The draft** (`src/drafts.ts`, IndexedDB `folio-drafts` - not
  localStorage, documents carry images): whenever the document is
  unsaved, its Markdown (and file name) is kept 600 ms after each
  change. A plain launch with a kept draft opens it - still unsaved -
  and flashes "Restored your unsaved work from <date, time>"; a
  `?doc=` launch opens the link and leaves the draft for later.
  Saving, or choosing **Discard changes**, clears it. Without storage
  (a private window) there is simply no draft.

## Acceptance

- e2e: `tests/e2e/web-files.spec.ts` (upload/download path; real-file
  path writes back to the same file; the draft survives a relaunch
  until saved; Discard clears it; the dialog offers Save).
- First-contact eval: `evals/web-files-first-contact.md`.
