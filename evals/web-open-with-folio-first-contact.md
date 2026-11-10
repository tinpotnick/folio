---
name: web-open-with-folio-first-contact
feature: "Open with folio on the web (docs/specs/web-files.md)"
steps:
  - In Chrome or Edge, open https://tinpotnick.github.io/folio/ and install it as an app (⋯ → Install folio).
  - In the OS file manager, choose Open with → folio for a .md file.
  - In the installed app, edit the document and press Ctrl+S.
expected:
  - The file manager offers folio for .md files once the app is installed.
  - The installed app opens the chosen .md file (not the welcome page or a restored draft).
  - Saving writes back to the same file without asking where.
---
# First-contact eval: open .md files with the web app

An agent playing a new user, using only visible affordances, installs
the web version and opens a Markdown file with it from the file
manager.
