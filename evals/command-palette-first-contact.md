---
name: command-palette-first-contact
feature: command-palette
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review"). Press Ctrl+K with
    no instruction.
  - Type "table" and press Enter.
  - Press Ctrl+K again. Type "regional summary" and press Enter.
  - Press Ctrl+K again. Type "shortcuts" and press Enter.
  - Press Ctrl+K once more. Type "save".
  - Click the magnifier button in the toolbar instead of Ctrl+K.
expected:
  - The palette opens on Ctrl+K and on the toolbar button; the
    input is focused and the list shows commands, then the
    document's sections, then help topics, each with a group tag.
  - "table" runs Insert a table: a new table block appears in the
    document.
  - "regional summary" jumps to that heading in the document.
  - "shortcuts" opens the help window at the Keyboard shortcuts
    topic.
  - "save" finds nothing to run on the web host (no Save command
    is listed); on the desktop it finds Save the document.
  - Esc closes the palette without running anything.
---
