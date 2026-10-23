---
name: web-files-first-contact
feature: web files and the unsaved draft (docs/specs/web-files.md)
steps:
  - In the web version (a later launch), write a short document and save it to your computer.
  - Open it again, change it, and save again.
  - Write something new, then close the tab without saving and open folio again.
  - Repeat the first two steps in a browser without real-file access (Firefox).
expected:
  - Save and Open are found without help (toolbar or Ctrl+K "save"/"open"); nothing is uploaded.
  - In Chrome/Edge the second Save writes the same file without asking again.
  - In Firefox, Save downloads a .md file and says so; Open reads a picked file.
  - The unsaved work comes back on the next launch, with a note saying it was restored.
---
# First-contact eval: web files

A new user can keep their work in the web version, and does not lose
it by closing the tab.
