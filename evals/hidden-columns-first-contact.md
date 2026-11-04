---
name: hidden-columns-first-contact
feature: table column visibility (docs/specs/table-inspector.md)
steps:
  - Start the demo host. Import `demo/data/calls-2026-03.db` (Ctrl+K
    "import data from a file"), choose the `cdr` table, Import.
  - Click the `uuid` column heading, then untick **visible** in the
    table inspector. (Or: click any cell, then run Ctrl+K "show or
    hide columns".)
  - Switch to the Markdown source view, then back.
expected:
  - The rendered table no longer shows the uuid column (13 headers
    instead of 14); every other column is unchanged.
  - The source records `hidden: true` on the uuid column and still
    contains every uuid value - the data is not cut. The dataset
    browser still lists the uuid column.
  - After switching views, the column is still hidden; re-ticking
    **visible** brings it back.
---
