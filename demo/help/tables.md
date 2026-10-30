# Tables and datasets

- folio has two kinds of table. A **Table** is a standard Markdown
  pipe table (`| a | b |`), exactly what GitHub shows; **+ Insert ›
  Table** inserts one. A **Dataset** adds an id, typed columns,
  units, formulas and a caption. Charts and formulas can only use
  datasets.
- Click a table to see its kind at the start of its bar. **Make it a
  dataset** upgrades a table; **Convert to simple table** turns a
  dataset back into a pipe table when nothing would be lost (the
  button says why when it can't). **+ Insert › Dataset** (or
  "dataset" in the palette) inserts one directly.
- Click a cell and type. Press Tab (or Enter) to finish the cell:
  formulas and charts recalculate the moment you leave it, and the
  Markdown source always contains what you typed. In the browser,
  Tab/Enter also move the caret to the next cell and grow the table
  at the last row; in the desktop app they commit the cell — click
  the next cell to continue. A row added this way that you leave
  without typing in goes away again, so pressing Enter to confirm a
  value never leaves an empty row behind.
- **Add or remove rows and columns**: right-click a cell (Insert row
  below, Delete row, Insert column right, Delete column), or with
  the cursor in a cell search Ctrl+K for "insert a row" / "insert a
  column". A new column is named `new`; click its header to rename it
  and to choose its type (text, number, date, formula).
- Clicking any cell or column heading reveals the **table
  inspector** above the table: the column's name, type, unit,
  format, the table's caption, and — for formula columns — the
  ƒx expression, editable in place (the same edit as changing
  the source by hand). Units show in the column headers ("q2
  (£k)") in a separate italic span. The header's **name** is
  editable directly: click it and type to rename the column —
  Enter commits (and drops into the column's first cell), Tab
  moves to the next header, Escape reverts. The unit itself is
  read-only; that is what the inspector is for.
- A table longer than the theme's window (`table.rows.show`,
  default 50) shows its head rows plus a "120 rows x 3 columns -
  showing first 50" line. To choose for one dataset, click it and
  pick **Rows** on its bar (5, 10, 25, 50, 100 or all), or search
  "rows shown" with Ctrl+K; it saves as `show: 12` on the table. The full data is always in the document
  (charts, formulas, and queries see every row); click **Open
  dataset** for the full-screen dataset view - the whole window,
  dressed like a spreadsheet: a toolbar with the dataset name, a
  Jexl filter (`v > 115 && region != "South"` - the charts'
  language), and the row count; a formula bar that shows the
  selected cell's value - or its formula for a computed column;
  and a numbered grid with continuous scrolling, click-header
  sorting (asc, then desc, then unsorted - a view sort, never
  written to the document), and click-to-edit cells (arrow keys
  move the selection, Enter edits). **✕** (or Esc) closes it and
  returns to the table; the grid button on the table's inspector
  bar opens it too.
