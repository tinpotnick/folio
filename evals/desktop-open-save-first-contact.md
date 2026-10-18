---
name: desktop-open-save-first-contact
feature: desktop-tauri-host
steps:
  - On a machine with the prerequisites (apps/desktop/README.md), run
    `npm run dev:desktop`.
  - The folio window opens with the sample document.
  - Click the folder icon (tooltip "Open") and pick a .md
    file from disk.
  - Edit the document (edit a table cell).
  - Click the save icon (tooltip "Save") and choose a
    location.
expected:
  - The window shows the same UI as the browser demo, with Open and
    Save icons (no file affordances on plain web).
  - Opening a file loads and renders it, including tables and charts.
  - Saving writes a .md file that re-opens identically (round-trip).
---
# First-contact eval: desktop Open/Save

An agent playing a new user, using only visible affordances, must
open a Markdown file from disk, edit it, and save it back to disk.
