---
name: sqlite-import-first-contact
feature: data-import (SQLite files and refresh from a file; docs/specs/data-import.md)
steps:
  - Start the demo host. Open the command palette (Ctrl+K) and run
    "Import data from a file (CSV, JSON or SQLite)"; choose the
    shipped `demo/data/calls-2026-03.db`.
  - In the dialog, choose the `cdr` table from the file's table list,
    then Import.
  - Import the gzipped archive object `demo/data/calls-2026-03.db.gz`
    the same way - it should decompress and import without a manual
    gunzip.
  - Add a formula column to the imported table using
    `fromUnix(start_at)`, and switch to the Markdown source view.
  - Come "next month": run "Refresh imported data from a file (CSV,
    JSON or SQLite)" from the palette and choose
    `demo/data/calls-2026-04.db`; confirm the listed table.
  - Try refresh with an unrelated CSV file.
expected:
  - The SQLite file's tables are listed with row counts and column
    counts; the chosen table previews with typed columns (numbers as
    numbers, phone-number text keeping leading zeros) and sample
    rows before anything changes. The `.db.gz` imports identically,
    with `import: "calls-2026-03.db.gz#cdr"`.
  - The import lands as a typed table with
    `import: "calls-2026-03.db#cdr"` in the source; the formula
    column reads `fromUnix(start_at)` and computes ISO date-times.
  - Refresh lists the imported table ("36 rows become 48"), and
    after confirming, the same table shows the April rows and the
    source now reads `import: "calls-2026-04.db#cdr"` - charts and
    formulas over it recalculate; the table's caption and position
    are unchanged.
  - Refresh with an unrelated file flashes "No table in this
    document was imported from ..." and changes nothing; a file
    named `.db` that is not a SQLite database shows a clear
    "not a SQLite database file" error.
---
