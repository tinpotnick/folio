# Blocker: `cargo check` for the Tauri desktop host cannot run in this sandbox

Task: Tauri desktop host (apps/desktop).

What fails: `cargo check` in `apps/desktop/src-tauri` fails in the
build sandbox because Tauri's Linux webview stack needs system
libraries that are absent and cannot be installed (no root):

- `pkg-config` (command not found)
- `gobject-2.0 >= 2.70` (via gobject-sys)
- and transitively webkit2gtk-4.1 / gtk+-3.0

Exact error:

    cargo:warning=Could not run `PKG_CONFIG_ALLOW_SYSTEM_CFLAGS=1
      pkg-config --libs --cflags gobject-2.0 'gobject-2.0 >= 2.70'`
    The pkg-config command could not be found.

What was tried: `cargo add tauri-plugin-dialog@2` then `cargo check`;
system search for webkit2gtk/ GTK libs (none present); no sudo/apt
access. Crates.io itself is reachable, so dependency resolution
succeeds — the failure is purely missing native system libraries.

What still passed: `npm run lint`, `npm test` (33), `npm run build`
including the `@tauri-apps/api` TypeScript surface.

How to unblock (on a dev machine with the prerequisites in
apps/desktop/README.md):

    npm install
    npm run dev:desktop

The Rust code is expected to compile as-is; if it does not, the next
agent should fix in `apps/desktop/src-tauri/src/lib.rs` only.
