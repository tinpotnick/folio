# Table context menu

## Status: accepted (2026-11-05)

## Decision

Right-clicking a table cell (or pressing **Shift+F10 / the Menu key**
with the caret in a cell) opens a Word/Excel-shaped context menu at
the pointer: grouped items with icons, separators, right-aligned
shortcut hints, and disabled states that carry their reason in the
tooltip. Every item is also a palette (Ctrl+K) command acting on
the caret's cell.

## Contract

- **Open**: right-click on any `td`/`th`, or Shift+F10 / Menu key
  with the caret in a cell (the menu opens at the cell). **Close**:
  a pick, a pointerdown anywhere outside the menu, or Esc - the
  same dismissal as every floating menu; the menu is clamped into
  the window once its real size is known.
- **Groups** (separated by hairlines):
  - _Top item_: **Open the dataset** - the full-window spreadsheet
    view of the table (spec: docs/specs/dataset-browser.md),
    disabled for simple tables with the reason as the tooltip. The
    same action is the table bar's labelled "Open dataset" button
    and the palette's "Open the dataset browser for the table at
    the caret".
  - _Clipboard_: **Cut** (Ctrl+X), **Copy** (Ctrl+C), **Paste**
    (Ctrl+V). Copy reads a formula cell's COMPUTED value; a header
    copies the column name. Cut/paste/clear are disabled outside an
    editable data cell (header, formula column) with the reason as
    the tooltip. Clipboard storage is the component's own buffer -
    always works offline, in tests, in WebKitGTK - with the system
    clipboard written best-effort on copy/cut and read best-effort
    on paste when the buffer is empty. Paste into a number column
    coerces numeric text to a number.
  - _Insert_: row above, row below, column left, column right. A
    new column is named `new`, `new_2`, ... (unique, case-blind).
  - _Delete_: row (disabled at one row - "a table keeps at least
    one row"), column (disabled at one column, or on a formula
    column - other formulas may read it; delete it from its
    inspector), **Clear contents** (empties the cell; disabled on
    headers and formula cells).
  - _Organize_: **Sort ascending** / **Sort descending** by the
    clicked column - a MODEL write (the document's rows reorder;
    unlike the dataset browser's view sort), using the query's
    comparison (numbers first-class, blanks last, text collated)
    and the recalculated values for a formula column. **Hide
    column '<name>'** sets `hidden: true` via the inspector's own
    path (disabled for simple tables and already-hidden columns).
    Hidden columns have no header to right-click, so while any are
    hidden the menu also lists **Show column '<name>'** for each
    (up to five individually, else one "Show all N hidden columns"),
    batching the model write in one re-render.
- **Styling**: the host toolbar's menu language (index.html
  `.menu`): 10px radius, 6px padding, 32px rows, 16px muted icons,
  `.menu-kbd` chips for shortcuts, `.menu-sep` hairlines, disabled
  items dimmed. `role="menu"` / `menuitem` / `separator`.
- **Edits are model writes**: every pick refreshes the table figure
  in place and reaches the Markdown source exactly like hand-editing
  the block, then emits change.
- **No stale commits**: a structural pick first commits the caret's
  cell and drops its focus - the re-render's removal-blur would
  otherwise write the old cell's text into the SHIFTED model (an
  inserted row inheriting the clicked cell's value; that bug predates
  the menu's rebuild and is fixed here). `commitCell` only commits
  the LIVE cell at its coordinates.
- **Palette parity**: "Insert a row above", "Insert a column to the
  left", "Clear the cell's contents", "Sort the table by the caret's
  column, ascending/descending", "Hide the column at the caret",
  "Copy/Cut the cell at the caret", "Paste into the cell at the
  caret" - all acting on the table cell at the caret.

## Acceptance

- Unit: `tests/engine/query.test.ts` (`sortedRows`: reorder without
  mutating, blanks last, text collated, formula columns by computed
  values).
- e2e: `tests/e2e/table-context-menu.spec.ts` (top item opens the
  dataset browser, then palette parity; groups/icons/hints/
  separators/disabled reasons; insert above/below/left/right and
  delete; sort asc into the source and desc on a formula column;
  hide column into the figure and source; copy/paste/cut/clear;
  copy of a computed formula value; Shift+F10 open, Esc and
  outside-click close).
- Eval: `evals/table-context-menu-first-contact.md`.
- Documented in `demo/help/tables.md`.
