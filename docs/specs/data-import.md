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

## The Import data dialog (2026-10-27)

- **Where**: + Insert › **Import data…** (Tables and charts), and the
  palette's "Import data", "Import data from the web (a CSV or JSON
  address)" and "Import data from a file (CSV or JSON)". It was
  palette-only, and users could not find it.
- **From a file**: "Choose a file…" (the existing file path) and "Use
  the demo dataset".
- **From the web**: an address and Fetch (or Enter). What comes back
  is previewed before anything changes: the row count, each column's
  name and inferred type, the first rows, a dataset name, a caption
  (the source's own title), the publisher, and a **licence line** -
  "Licence: <name> - fine to share with the source credited", or
  "Licence unknown - check the publisher's terms before sharing", plus
  any publisher-specific notice. Import inserts the table at the
  caret. Column names are editable in the preview (a series code
  such as IUMBV34 is a poor name); when the source's title is only a
  code, the caption starts empty, asks "What is IUMBV34?", and takes
  focus. Import shows only once there is something to import.
- **Fetching** (ADR-0029): the desktop app fetches through Rust
  (`fetch_url`: http/https only, GET, no cookies, 30 s, 20 MB, a user
  agent naming folio with a contact address). A browser page can only
  read sites that allow it (CORS), and the open-data publishers do
  not: when the page's fetch is refused, the dialog says so, links the
  address to download, and reads the downloaded file as if fetched -
  the web address stays the recorded source.
- **Reading** (`src/engine/sources.ts`): CSV and JSON as for files;
  the ONS website's CSV layout (metadata lines, then years, quarters,
  months - the finest series present wins, its CDID names the column,
  its Title becomes the caption); an HTML page is an error ("returned
  a web page, not data - look for a CSV or JSON download link").
- **Types**: `date` joins `number` and `text`: a column is a date when
  every value present reads as one - ISO, `2024-03`, `31 Mar 2024`
  (Bank of England), `2024 MAR` (ONS), `March 2024` - and is written
  ISO. Day/month numeric dates (`03/04/2024`) are ambiguous and stay
  text. Published "no value" markers (FRED's `.`, `NA`, `n/a`) are
  empty cells, not text.
- **Provenance and citation**: the table records `import: "<url>"`,
  `retrieved: <ISO date>` and, when "Add the source to the
  bibliography" is ticked (the default), `cite: <key>`. The key
  (`boe_iumabedr`, `ons_cpi`) gets a BibTeX `@misc` entry in the
  document's bibliography (created if there is none) with the
  publisher as an organisation author, the title, `howpublished =
{Dataset}`, the URL, `urldate`, and the licence as a note. The table
  shows "Source: <narrative citation>" under its caption, so it is
  cited in the document's style and its reference is listed: APA
  "Bank of England. (2026). Bank Rate [Data set]. Retrieved 27 October
  2026, from <url>"; IEEE "… Accessed: Oct. 27, 2026. [Online].
  Available: <url>".
- **Known publishers** (by address, with the licence their terms
  state - checked 2026-10-27, see docs/research/open-data-licences.md):
  ONS (OGL v3), Bank of England (OGL v3; some third-party exchange
  rates excluded), OECD (CC BY 4.0), HM Land Registry (OGL v3), FRED
  (no licence claimed: it re-publishes other owners' data - "check
  the series' notes before sharing"). Any other address: publisher =
  its host, licence unknown.
- **Charting it**: "Chart it" on a table with a date column draws a
  line chart over the dates, one line per number column (up to six),
  captioned with the table's caption; dated x axes label years (or
  "Mar 2024" over a shorter span) and keep the last label inside the
  chart (chart-rendering).
- **Rows and columns**: the table's right-click menu (now outside the
  editable article, so its clicks always land; new columns are named
  `new`, `new_2`, …) and the palette's "Insert a row below", "Insert a
  column to the right", "Delete the row", "Delete the column", acting
  on the cell at the caret.
- **Open data** (the dialog's middle tab, 2026-10-27;
  `src/engine/catalog.ts`): a publisher, its series, a year to start
  from, Fetch - then the same preview. Only publishers whose terms let
  a document holding their data be shared (with credit), and that
  need no key or account (docs/research/open-data-licences.md):
  - **Bank of England** (OGL v3): Bank Rate (average, end of month),
    2/3/5-year fixed mortgage rates (75% LTV), the revert-to rate, the
    10-year gilt yield; several at once (they share dates), or any
    series code typed in. Fetched as the titled CSV (`CSVF=TT`), whose
    descriptions title any code.
  - **ONS** (OGL v3): CPI and CPIH inflation, the CPI index, average
    weekly earnings.
  - **OECD** (CC BY 4.0): share price indices (UK, US, Germany, France,
    Japan; 2015 = 100, price only - the licence line says dividends are
    excluded), UK long and short interest rates, the US long rate.
  - **HM Land Registry** (OGL v3): the UK House Price Index for the UK,
    its nations and London - average price, index, yearly and monthly
    change.
  - **ECB** (free reuse with credit): pound and dollar per euro.
  - **Eurostat** (CC BY 4.0): euro-area inflation.
  - **FRED**: any series ID, with its "check the series' notes"
    notice (it re-publishes other owners' data).
  The preview names the columns as the catalogue does (`date`,
  `bank_rate`, `fixed_2y`, `uk_shares`), the caption from the series'
  titles, the dataset after its series (`boe_series` for several),
  and keeps rows from the chosen year. The publishers' layouts are
  read by `parseFetched`: SDMX-CSV (OECD, ECB, Eurostat - the period
  and the value; the descriptions become the title), the House Price
  Index download (the all-property-types columns of ~60), the Bank's
  titled CSV, the ONS CSV.
- **Personal use only** (2026-10-27): data whose terms do not allow
  sharing - a price history downloaded from a broker or a finance site
  - imports **From a file**, previewed like the rest, with an optional
  **Came from** address (then it is cited) and a **Personal use only**
  tick. The table records `licence: "personal-use"`; it, and every
  chart drawn from it, shows "Personal use only - not for sharing"
  on screen and on paper; the BibTeX note says "Licence: personal use
  only, not for redistribution"; Print and Export say "This document
  contains personal-use data (...) - check its terms before sharing" -
  a reminder, never a block. folio records the terms; the user, who
  agreed to them, decides. Other imports record their licence's name
  in `licence:` too.
- Not yet: Refresh (fetch again into the same table); keyed market-data
  providers (they need a key store; see the research note).

## Shipped demo data

- `demo/examples/repay-or-invest.md` - "Open example: Repay or invest?
  A mortgage question" (2026-10-27): Bank of England mortgage rates,
  OECD UK share prices and ONS CPI from January 2010, imported through
  Open data and cited; an assumptions table (loan, term, monthly extra,
  dividend yield) drives a month-by-month model built from `pmt`,
  `asof`, `eomonth` and running balances; a summary table and charts
  compare overpaying with investing, in pounds of the day and of 2010.
  Every figure recalculates when an assumption changes. All three
  sources are open-licensed, so the example itself is shareable.

- `demo/data/monthly-sales.csv` - 72 rows (24 months x 3
  regions), realistic seasonality and per-region trends; the
  palette command "Import the demo dataset" imports it through
  the same machinery with no file dialog (it is the demo path
  for trying import - and for first-contact evals).
- `demo/data/site-metrics.json` - 24 records, array-of-objects
  shape, for trying JSON.
- `demo/examples/report.md` - "Open example: An imported data report": the
  finished article - an imported 72-row table (with the growth
  running formula and a document-chosen `table.rows.show: 24`
  window), two line charts over it, and prose that reads like a
  report. Round-trips byte-identically like every document.

## Non-goals

- **Live links / refresh** - not now; the snapshot + metadata
  contract is the precondition for a later explicit refresh.
- **Parquet** - follow-up with its own ADR (dependency check:
  `hyparquet`, MIT, pure JS, lazy-loaded like mermaid/KaTeX).
- **Deduplication, joins, SQL** - the Jexl formula and chart
  query languages already compose over imported data.

## Acceptance

- From the web: `tests/engine/sources.test.ts` (BoE, FRED, ONS
  layouts; HTML is an error; the citation entry in both styles),
  `tests/engine/ingest.test.ts` (dates, missing markers),
  `tests/e2e/import-web.spec.ts` (the dialog from + Insert, preview,
  licence, the source line and reference; the browser's
  download-then-choose route; an HTML address); Rust
  `only_web_addresses_are_fetched` and the hand-run
  `fetches_live_publishers`. Eval: `evals/import-web-first-contact.md`.

- Engine: `tests/engine/ingest.test.ts` (12 tests: RFC-4180
  quoting, type inference with value conversion, header
  sanitization/dedupe, CRLF, JSON shapes and errors, provenance
  round-trip).
- e2e: `tests/e2e/import.spec.ts` (5 tests: CSV import with
  inference + provenance, JSON import, the 2,000-row viewport
  case, invalid file is a visible error, palette entry).
- First-contact eval: `evals/data-import-first-contact.md`.
- Documented in `demo/help.md`.
