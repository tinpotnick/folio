# Data import (CSV, JSON)

## Status: accepted (2026-10-18)

## Decision

A picked CSV or JSON file becomes a typed table INSIDE the
document - the import SNAPSHOT, in ADR-0005's terms. Nothing is
ever a live binding: the data is the document's, and the file's
name rides along as provenance metadata (`import: "sales.csv"`).
Charts, formulas, and cross-table references work over imported
data exactly like hand-authored tables.

## Contract

- **Entry point**: the palette command "Import data from a file
  (CSV or JSON)" (`<input type="file">`, the one code path for
  web and every Tauri webview). Without a document caret the
  table appends at the end. Files over 8 MB are refused with a
  visible message.
- **CSV** (`src/engine/ingest.ts`, RFC-4180): first row is the
  header; quoted fields, commas and newlines inside quotes,
  doubled quotes, CRLF or LF. Rows longer than the header
  truncate to it; ragged rows pad.
- **JSON**: an array of objects (keys become columns in
  first-seen order) or an array of arrays with a string header
  row. Anything else is an error with guidance - a visible
  flash, never a broken document.
- **Column names** are sanitized to identifier-legal (spaces and
  dashes become underscores; empty becomes `col_N`; a leading
  digit gets a `c_` prefix) and deduped case-insensitively - so
  formulas and cross-table references can always use them.
- **Type inference**: a column is `number` when every non-empty
  value is numeric (values then carry actual numbers, the model
  contract formulas and formats rely on); otherwise `text`.
- **Provenance**: `table.import` (quoted string, round-trips
  byte-identically) records the origin file. A future
  re-import/refresh command can use it; nothing reads it at
  render time.
- **Id**: the file name slugified to identifier-legal, made
  unique within the document (`sales`, `sales_2`).
- **Scale**: imported tables are ordinary tables - a 2,000-row
  import renders as a viewport table (50 rows in flow, the
  status line citing the full count) and browses in the dataset
  browser (docs/specs/dataset-browser.md). The Markdown source
  carries every row; a multi-MB source view is the known ceiling
  (see section-windowing.md).

## Non-goals

- **Live links / refresh** - not now; the snapshot + metadata
  contract is the precondition for a later explicit refresh.
- **Parquet** - follow-up with its own ADR (dependency check:
  `hyparquet`, MIT, pure JS, lazy-loaded like mermaid/KaTeX).
- **Deduplication, joins, SQL** - the Jexl formula and chart
  query languages already compose over imported data.

## Acceptance

- Engine: `tests/engine/ingest.test.ts` (12 tests: RFC-4180
  quoting, type inference with value conversion, header
  sanitization/dedupe, CRLF, JSON shapes and errors, provenance
  round-trip).
- e2e: `tests/e2e/import.spec.ts` (5 tests: CSV import with
  inference + provenance, JSON import, the 2,000-row viewport
  case, invalid file is a visible error, palette entry).
- First-contact eval: `evals/data-import-first-contact.md`.
- Documented in `demo/help.md`.
