# Desktop host (Tauri v2)## Status: accepted (2025-12-12)## DecisionADR-0006 names Tauri as the desktop host of the `<folio-doc>` webcomponent. `apps/desktop/` is that host: a thin Tauri v2 shell aroundthe existing web UI — no engine or UI logic is duplicated.## Contract- `apps/desktop/src-tauri/` — Rust shell: window config, native   file dialogs via `tauri-plugin-dialog`, and two commands:  - `open_document(current) -> { path, text }` (a picked file's path and Markdown text; the host remembers the path)  - `save_document(text, suggested, current) -> String` (path written)- The web page detects Tauri at runtime (`__TAURI_INTERNALS__`,   `src/desktop.ts`) and shows a native Open/Save icon group (a segmented toolbar group, like the view switch) in the   toolbar. On plain web nothing changes (the Tauri API chunk   is dynamically imported and no file affordances exist on web;   export is by copying the Markdown source).- The document remains plain Markdown text across the bridge —   the file on disk round-trips through the existing golden-tested   parse/serialize.- Permissions: the shell registers   `Builder::on_permission_request` and allows   `PermissionKind::Microphone` — recording is a first-class   feature and the record button is the consent gesture   (docs/specs/audio-embeds.md); everything else falls through to   the platform default.Acceptance:- Web contract unchanged: `just lint`, `just test`, `just build`   stay green with the Tauri frontend surface compiled in.- First-contact eval: `evals/desktop-open-save-first-contact.md`.- The host page is covered end-to-end by `tests/e2e/` (Playwright),   including the web degradation of the Open/Save buttons.- Full GUI build requires webkit2gtk system libs (see   `apps/desktop/README.md`); not available in headless CI sandboxes.   Verified working on Linux with those prerequisites: `cargo check`,   debug build, and `npm run dev:desktop` all pass.

## Dialog folders (2026-10-20)

The Open and Save dialogs start in the CURRENT DOCUMENT's folder
when it came from disk: `open_document` returns `{ path, text }`,
the host remembers the path, and both dialogs receive it as a
directory hint (`set_directory(parent)`). Save also defaults the
file name to the open document's own.

In-memory documents (examples, followed links, imports) have no
folder. Their dialogs fall back to the LAST USED folder: the
Rust host remembers the parent of every file opened or saved in
`last-folder` under the app's config dir (best-effort, plain
text), so even a fresh start lands where the user last worked
instead of the platform's Recent view. On the true first run
nothing has been opened or saved yet, so the dialog falls back
further: the folder the DEFAULT document was loaded from —
`tauri dev` serves `demo/` straight from the checkout
(`dev_demo_dir`, resolved from `CARGO_MANIFEST_DIR`), so the
boot document counts as a real file even though the host loaded
it as a web asset. Hints pointing at folders that no longer
exist are skipped; the resolution order and skip rules are
unit-tested in `src-tauri/src/lib.rs` (`folder_hint`).

A bundled release carries the demo too: `vite build` copies `demo/`
into `dist/demo/` (the `copyDemo` plugin in `vite.config.ts`), so
the boot document, examples, help and imported data survive in the
packaged app — without it, a release build booted with an empty
document because vite only serves `demo/` from the repo root in
dev. Embedded content has no disk folder to offer the dialogs, so
release first runs still see the platform default.


## WebKitGTK has no shadow-root selection (2026-10-21)

The desktop app renders with WebKitGTK, which has NO
`shadowRoot.getSelection()`. Anything that reads or sets the caret
inside `<folio-doc>` must go through the component's `caretPoint()` /
`setCaret()`. They use the shadow selection where it exists
(Chromium), else the standard `getComposedRanges({ shadowRoots })` to
read and `setBaseAndExtent()` to write (WebKit silently IGNORES
`addRange()` for a range inside a shadow root). Before this, the
list buttons acted on the last CLICKED paragraph and Tab never
nested, in the desktop app only, while every Chromium test passed.

**Contract tests in the real engine**: `just test-webkitgtk` (with
`npm run dev` running) drives WebKitGTK through PyGObject
(`tests/webkitgtk/run.py`; each `*.js` case is a page-evaluated
function body reporting `| check: true` results). Run it for any
change touching the caret, selection, or keyboard handling.
