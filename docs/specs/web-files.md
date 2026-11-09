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
- **Prettify on save**: what is written is the canonical serialization
  (`canonicalMarkdown` = parse + serialize, src/engine/doc.ts), from
  either view - folio owns the file format, and the round-trip
  invariant already demands the canonical form. A document that does
  not parse (mid-edit in the Markdown view) saves its raw text -
  saving is never blocked by a parse error.
- **The unsaved-changes dialog** offers Save on the web too.
- **The draft** (`src/drafts.ts`, IndexedDB `folio-drafts` - not
  localStorage, documents carry images): whenever the document is
  unsaved, its Markdown (and file name) is kept 600 ms after each
  change. A plain launch with a kept draft opens it - still unsaved -
  and flashes "Restored your unsaved work from <date, time>"; a
  `?doc=` launch opens the link and leaves the draft for later.
  Saving, or choosing **Discard changes**, clears it. Without storage
  (a private window) there is simply no draft.

## Open with folio on the web (File Handling API, 2026-10-24)

The desktop packages register folio as a Markdown editor
(docs/specs/desktop-tauri-host.md, "Open with folio"); the web version
gets the same OS-level association the one way the web has - the File
Handling API, on an INSTALLED app (Chrome, Edge, ChromeOS):

- `public/manifest.webmanifest` (linked from `index.html`) declares
  `file_handlers` for `text/markdown` / `text/x-markdown` accepting
  `.md` and `.markdown`, plus the icons and `start_url` that make the
  site installable. Once installed, the OS offers folio for .md files
  ("Open with folio").
- `public/sw.js` is the service worker that makes the app installable
  and launchable with files, and caches the app shell (same-origin
  GET; `/pyodide/` and `/repo/` always go to the network) so the
  installed app works offline. Registered in `src/main.ts` only on a
  production web build - never in dev, never in the desktop shell.
- `src/web-files.ts` `onWebLaunch` wraps `window.launchQueue`; the
  page opens each launched file as the open, clean document and keeps
  its handle, so Save writes back to it (write permission is asked
  at save time, never at open). The launch that started the app opens
  its file before anything else - not the guide or a restored draft;
  a later launch on a running app goes through the unsaved-changes
  check, like the desktop's macOS event.

## Acceptance

- e2e: `tests/e2e/web-files.spec.ts` (upload/download path; real-file
  path writes back to the same file; the draft survives a relaunch
  until saved; Discard clears it; the dialog offers Save).
- e2e: `tests/e2e/web-launch-file.spec.ts` (launchQueue stubbed: a
  launch with a file opens it and Save writes back to it; a launch
  without files starts as usual; a later launch replaces the
  document).
- First-contact eval: `evals/web-files-first-contact.md`,
  `evals/web-open-with-folio-first-contact.md`.
