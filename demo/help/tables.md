# Tables and datasets

- folio has two kinds of table. A **Table** is a standard Markdown
  pipe table (`| a | b |`), exactly what GitHub shows; **+ Insert ›
  Table** inserts one. A **Dataset** adds an id, typed columns,
  units, formulas and a caption. Charts and formulas can only use
  datasets.
- Click a table to see its kind at the start of its bar. **Make it a
  dataset** upgrades a table; **Convert to table** turns a
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
- **Add or remove rows and columns**: right-click a cell (or press
  Shift+F10 in a cell) for the **context menu** — its top item is
  **Open the dataset** (the whole table in a full-window spreadsheet
  view), then clipboard (Cut, Copy, Paste), Insert (row
  above/below, column left/right), Delete (row, column, clear
  contents), and Organize (sort the table by this column ascending
  or descending, hide the column), each with its icon and shortcut,
  disabled with a reason when it cannot run (a formula column cannot
  be deleted or cleared; a simple table's columns cannot be hidden).
  Sorting rewrites the table's rows in the document. The same
  actions are in the palette: with the cursor in a cell, Ctrl+K
  "insert a row", "sort", "hide the column", "copy the cell", "open
  the dataset browser", and so on. A new column is named `new`;
  click its header to rename it and to choose its type (text,
  number, date, formula).
- Clicking any cell or column heading reveals the **table
  inspector** above the table, laid out like a spreadsheet — and it
  shows WHICH column it is editing: the clicked column lights up in
  the table (accent ring on its header, tinted cells) while the bar
  is open. The bar's first row is table-level, in a fixed order, on
  one line: the kind label (truncating if long), **Open dataset**,
  **Convert to table**, **Rows**, **Chart it**. The **caption** then
  takes its own full-width line.
  Then the column editor: one group box holding the column picker and all
  that column's formatting options (**visible**, type, unit, format),
  and directly under it a full-width **ƒx row** — together they are
  the column's own block, nearest the table. The ƒx row is always
  there, like a spreadsheet's formula bar: a large textarea for the
  expression (Enter applies, Shift+Enter for a new line), the same
  edit as changing the source by hand. It enables when the column's
  type is formula (set it in the same box); until then it is
  disabled and says so. Untick **visible** to hide
  a column from the rendered table (an import's uuid, say) - the
  column stays in the data: formulas, charts and the dataset
  browser still see it. Faster for several columns: **right-click a
  column header** and choose **Hide column '…'**; while any are
  hidden, the right-click menu offers each back (**Show column
  '…'**). (Ctrl+K "show or hide columns" opens this
  bar too.) Units show in the column headers ("q2
  (£k)") in a separate italic span. The header's **name** is
  editable directly: click it and type to rename the column —
  Enter commits (and drops into the column's first cell), Tab
  moves to the next header, Escape reverts. The unit itself is
  read-only; that is what the inspector is for.
- A dataset can end with a **totals row** (spec: table-totals.md) - a
  derived footer, not stored data: charts and formulas never see it.
  Declare it in the source with a `totals:` section, one entry per
  column; the expr is the usual formula language over the whole
  column, so `self.col.amount | sum()` is folio's sum(A1:A20):

```
totals:
  - {col: qty, expr: "self.col.qty | sum()"}
  - {col: amount, expr: "self.col.amount | sum()"}
```

  The footer shows "Total" plus each computed cell (formatted with
  its column's format, e.g. currency) and updates the moment you
  edit a cell. Expressions can do arithmetic too:
  `self.col.amount | sum() * 0.2` for VAT.
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
  returns to the table; the table bar's **Open dataset** button and
  the context menu's top item open it too.
- **Chips and pickers** (specs: select-columns.md,
  date-column-controls.md): a column of `type: select` with
  `options: [todo, doing, done]` renders its cells as chips and edits
  via a dropdown on click (`multi: true` makes it multi-select - one
  chip per value, checkable list). `type: date` / `type: datetime`
  columns open a calendar / date-time picker on click. Values are
  validated against the options; a bad value shows as an error chip.
