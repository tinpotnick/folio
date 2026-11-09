---
name: table-context-menu-first-contact
feature: table-context-menu
steps:
  - Open the demo host on the field-operations example (palette:
    "Open example: field operations" if not loaded).
  - Right-click the q2 cell of the North row.
  - In the menu, click "Sort ascending"; then right-click the
    growth column's cell and click "Sort descending".
  - Right-click the q2 header cell and click "Hide column".
  - Right-click a data cell, choose Copy; right-click another data
    cell, choose Paste.
  - With the caret in a cell, press Shift+F10, pick "Insert row
    above", then press Escape.
  - With the caret in a cell, open the palette (Ctrl+K), search
    "clear the cell", and run it.
expected:
  - The menu opens at the pointer with its top item "Open the
    dataset" (which opens the full-window spreadsheet view), then
    five groups (clipboard, insert, delete, organize), each row
    carrying an icon, the clipboard rows a Ctrl-key hint, and
    separators between groups; it closes on Esc, on an outside
    click, and on a pick.
  - Sorting by q2 ascending puts Midlands first and the Markdown
    source lists the rows in the new order; sorting the formula
    column descending puts North first (it computes the largest
    growth).
  - Hiding q2 removes the column from the figure but the source
    keeps it with `hidden: true`; the bar's column picker marks it
    "(hidden)".
  - Copy then paste writes the copied value into the target cell,
    and the source shows it.
  - Shift+F10 opens the same menu from the keyboard; "Insert row
    above" lands a blank row above the caret's row.
  - The palette's "Clear the cell's contents" empties the caret's
    cell and the source follows.
  - Disabled items say why in their tooltip: on the formula column,
    Delete column, Cut, Paste and Clear contents are disabled.
---
