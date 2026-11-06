---
name: hidden-columns-first-contact
feature: table column visibility (docs/specs/table-inspector.md)
steps:
  - Start the demo host. Import `demo/data/calls-2026-03.db` (Ctrl+K
    "import data from a file"), choose the `cdr` table, Import.
  - Right-click the `uuid` column heading and choose **Hide column
    'uuid'**; then right-click `transcription` and hide that too.
    (Or: click a cell and untick **visible** in the table inspector,
    or run Ctrl+K "show or hide columns".)
  - Right-click any cell and choose **Show column 'uuid'** to bring
    one back.
  - Switch to the Markdown source view, then back.
expected:
  - Each right-click hides one column immediately (14 headers, then
    13, then 12) with no inspector round-trip; "Show column 'uuid'"
    brings it back (13 again).
  - The source records `hidden: true` on the hidden columns and
    still contains every value - the data is not cut. The dataset
    browser still lists the hidden columns.
  - After switching views, hidden columns stay hidden; the inspector
    checkbox and the right-click menu agree (both read the model).
---
