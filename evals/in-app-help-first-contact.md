---
name: in-app-help-first-contact
feature: in-app-help
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations").
  - Without instructions, look for a way to learn the app.
  - Click the visible "?" toolbar button.
  - Read how to open and save documents; close the help window.
  - Press the ? key with nothing focused; close with Esc.
expected:
  - The Help control is visible in the toolbar on both web and desktop.
  - The help window opens without leaving or disturbing the open document.
  - The help content renders as a folio document (headings, a table of shortcuts).
  - Esc closes the window and focus returns to the app.
  - Pressing ? while typing in the source editor does NOT open help.
---

# First-contact eval: in-app help

An agent playing a new user, using only visible affordances, must be
able to find and open the help window, learn how to open/save a
document, and dismiss it — in both the web and desktop hosts.
