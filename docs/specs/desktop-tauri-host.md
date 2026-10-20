# Desktop host (Tauri v2)## Status: accepted (2025-12-12)## DecisionADR-0006 names Tauri as the desktop host of the `<folio-doc>` webcomponent. `apps/desktop/` is that host: a thin Tauri v2 shell aroundthe existing web UI — no engine or UI logic is duplicated.## Contract- `apps/desktop/src-tauri/` — Rust shell: window config, native   file dialogs via `tauri-plugin-dialog`, and two commands:  - `open_document() -> String` (Markdown text from a picked file)  - `save_document(text, suggested) -> String` (path written)- The web page detects Tauri at runtime (`__TAURI_INTERNALS__`,   `src/desktop.ts`) and shows a native Open/Save icon group (a segmented toolbar group, like the view switch) in the   toolbar. On plain web nothing changes (the Tauri API chunk   is dynamically imported and no file affordances exist on web;   export is by copying the Markdown source).- The document remains plain Markdown text across the bridge —   the file on disk round-trips through the existing golden-tested   parse/serialize.Acceptance:- Web contract unchanged: `just lint`, `just test`, `just build`   stay green with the Tauri frontend surface compiled in.- First-contact eval: `evals/desktop-open-save-first-contact.md`.- The host page is covered end-to-end by `tests/e2e/` (Playwright),   including the web degradation of the Open/Save buttons.- Full GUI build requires webkit2gtk system libs (see   `apps/desktop/README.md`); not available in headless CI sandboxes.   Verified working on Linux with those prerequisites: `cargo check`,   debug build, and `npm run dev:desktop` all pass.

## Dialog folders (2026-10-20)

The Open and Save dialogs start in the CURRENT DOCUMENT's folder,
never the home folder: `open_document` returns `{ path, text }`,
the host remembers the path, and both dialogs receive it as a
directory hint (`set_directory(parent)`). Save also defaults the
file name to the open document's own. In-memory documents
(examples, followed links, imports) have no folder - the hint
clears and the dialog falls back to the platform default.

