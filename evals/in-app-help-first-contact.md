---
name: in-app-help-first-contact
feature: in-app-help
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review").
  - Without instructions, look for a way to learn the app.
  - Click the visible "?" toolbar button.
  - Read how to open and save documents; close the help window.
  - Press the ? key with nothing focused; close with Esc.
  - In the help, click an outside link (Graphviz, Vega-Lite, strudel.cc).
expected:
  - The Help control is visible in the toolbar on both web and desktop.
  - The help window opens without leaving or disturbing the open document.
  - The help content renders as a folio document (headings, a table of shortcuts).
  - Esc closes the window and focus returns to the app.
  - Pressing ? while typing in the source editor does NOT open help.
  - An outside link in the help opens: a new tab on the web, the
    system browser in the desktop app; the document stays as it was.
---

# First-contact eval: in-app help

An agent playing a new user, using only visible affordances, must be
able to find and open the help window, learn how to open/save a
document, and dismiss it — in both the web and desktop hosts.
