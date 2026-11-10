---
name: desktop-default-md-first-contact
feature: "Open with folio (docs/specs/desktop-tauri-host.md)"
steps:
  - In the desktop app, press Ctrl+K and type words for making folio the default app for .md files (e.g. "default md").
  - Run the matching command and read the flash message.
  - In the OS file manager, check a .md file's Open with list (and on Linux/macOS the default).
expected:
  - The palette entry "Open .md files with folio by default" is found by search alone.
  - Running it reports what happened (association set, or Settings opened on Windows).
  - On Linux/macOS, .md files now open with folio by default; on Windows, Settings → Default apps is open for the user to pick folio.
---
# First-contact eval: default .md app from inside folio

An agent playing a new user, using only visible affordances, finds and
runs the command that makes folio the default app for .md files.
