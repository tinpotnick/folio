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

WebKitGTK also names Shift+Tab (GTK's ISO_Left_Tab) as key
**"Unidentified"**; only `code` is "Tab". Every Tab check goes through
`isTabKey(ev)` (`key` OR `code`). Before this, Shift+Tab was dead in
lists and tables on the desktop only.

**Contract tests in the real engine**: `just test-webkitgtk` (with
`npm run dev` running) drives WebKitGTK through PyGObject
(`tests/webkitgtk/run.py`; each `*.js` case is a page-evaluated
function body reporting `| check: true` results; a first line
`// native-key: shift+ISO_Left_Tab` sends that REAL key press, since
synthetic DOM events cannot catch how the engine names keys). Run it
for any
change touching the caret, selection, or keyboard handling.

It runs **headless** (2026-10-29): its windows open on a private GTK
Broadway display (`broadwayd`, part of GTK 3) that nothing views, so
the suite never takes over the screen or the keyboard while someone
works. Two Broadway gaps are filled: its screen has no resolution
(-1 dpi, which WebKitGTK turned into a devicePixelRatio of -1/96 and
pages -122880px wide), so the runner sets 96; and its keymap reports
each keyval as its keycode, so real key presses carry XKB keycodes from
a table (`XKB_CODES`; a case pressing a key not in it stops with a
message to add it). `FOLIO_WEBKITGTK_VISIBLE=1` shows the windows on
your own display instead; `just test-webkitgtk help-panel` runs only
the named cases.

## Toolbar and title (2026-10-21)

- New, Open and Save are one toolbar group, first in the bar; New
  shows on the web too, Open and Save only on the desktop.
- The wordmark is hidden on the desktop (`html.desktop`): the
  window's title bar names the app and the document ("Q3 Sales
  Review — folio"), set through `getCurrentWindow().setTitle()`
  (capability `core:window:allow-set-title`).
- Ctrl+N / Ctrl+O / Ctrl+S: new, open, save. See
  docs/specs/toolbar.md.

## Outside links (2026-10-22)

- `open_external(url)`: opens http/https/mailto addresses in the
  system browser or mail app via tauri-plugin-opener (ADR-0024);
  every other scheme is refused. Document and help links use it.

## Open with folio (2026-10-23)

- Every package registers folio as an editor for Markdown
  (`.md`, `.markdown`, `text/markdown`): `bundle.fileAssociations` in
  `tauri.conf.json`; the .deb/.rpm desktop entry
  (`packaging/linux/folio.desktop.hbs`) and the Flatpak's
  (`packaging/linux/io.github.tinpotnick.folio.desktop`) run
  `folio %F` with `MimeType=text/markdown;text/x-markdown;`; the
  store listing `provides` the media type.
- The shell keeps the first non-option argument as the launch file
  (`launch_file_from_args`, unit-tested; a `file://` prefix is
  dropped). The page asks for it once at boot (`launch_document`):
  launched with a file, folio shows that file - not the blank page,
  the guide or a restored draft - as the open, clean document, and
  Save writes back to it. On macOS, files arrive by event
  (`RunEvent::Opened` → `folio-open-file`); the page opens each after
  the unsaved-changes check.
- e2e: `tests/e2e/launch-file.spec.ts` (Tauri bridge stubbed).

## Support link (2026-10-23)

- "Support folio (Buy Me a Coffee)" in the palette and a help
  section open https://buymeacoffee.com/tinpotnick outside folio;
  the store listing carries it as the donation URL and
  `.github/FUNDING.yml` adds GitHub's Sponsor button.
