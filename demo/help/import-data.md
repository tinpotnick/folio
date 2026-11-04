# Importing data

**+ Insert › Import data…** (or search "import" with Ctrl+K) opens a
dialog with three ways in, and the same preview for each - the rows,
the column types (dates become real dates), names you can change, a
caption, who published it and its licence - before anything changes.

- **From a file**: a CSV or JSON file, or a SQLite database (`.db`,
  `.sqlite`) - a file with several tables asks which one to import;
  every table is listed, with tool bookkeeping (like litestream's)
  grouped under "Internal tables" at the end. A gzipped file
  (`.db.gz`, straight from an archive) is decompressed for you. Or
  try "Use the demo dataset". If you downloaded it from the web,
  fill in **Came from** with the address and it is cited like any
  source.
- **Open data**: pick a publisher and the series you want, and the
  year to start from - the Bank of England (Bank Rate, 2-, 3- and
  5-year fixed mortgage rates, the standard variable rate, gilt
  yields), ONS (inflation, earnings), OECD (share price indices for
  the UK, US and others; interest rates), HM Land Registry (house
  prices by region), the ECB (exchange rates), Eurostat. All of it
  may be shared in a document with the source credited, and none
  needs an account. OECD's share price indices leave out dividends:
  add a stated dividend assumption if you model returns.
- **From a web address**: the address of any CSV or JSON download.
  The desktop app fetches any address; in a web browser most data
  sites refuse a page's request, so folio offers a link to download
  the file and then reads that file - still recording the web
  address as the source.

## Sources and licences

- Leave **Add the source to the bibliography** ticked and the table
  shows "Source: Bank of England (2026)" under it, the References
  list gains the dataset with the date it was retrieved, and you can
  cite it in the text like any reference (`[@boe_series]`).
- Open-government data can be shared with the source credited;
  "licence unknown" may not be yours to publish.
- For data whose terms do not allow sharing - a price history from a
  broker or a finance site - tick **Personal use only**: the table
  and its charts say "Personal use only - not for sharing", on screen
  and on paper, and Print and Export remind you before the document
  leaves your hands. folio records the terms; you decide.

## What you get

- The file becomes a typed table in the document - numeric columns
  are inferred, the header names become formula-usable column names,
  and `import: "file.csv"` in the source records where the data came
  from (`retrieved:` and `cite:` too, for data from the web). A table
  from a SQLite file records `import: "cdr_2026_03.db#cdr"` - the
  file and the table in it.
- It is a snapshot, not a link: the document stays one offline file,
  and says the same thing next year.
- Big imports render as windowed tables and browse in the dataset
  browser (see [Tables and datasets](tables.md)).
- The "Open example: An imported data report" entry shows what a
  finished imported-data report looks like.

## SQLite databases, and a report you refresh monthly

A SQLite file (`.db`, `.sqlite`, `.sqlite3`) is read directly - no
tool, no server, offline. The dialog lists its tables with their row
counts; pick one and the usual preview shows it. Column types come
from the database's own schema: numbers stay numbers, and text stays
text - a phone number keeps its leading zero. Timestamps stored as
unix seconds (a CDR's `start_at`) import as numbers; turn one into a
date in a formula column with `fromUnix(start_at)`.

Come the next month, search **refresh** with Ctrl+K and run
**Refresh imported data from a file**: pick the new month's file and
every table that was imported from the previous one (or a file named
like it - `cdr_2026_01.db` is refreshed by `cdr_2026_02.db`) is
listed with its old and new row counts. Confirm, and the tables take
the new data in place - their captions, licences and citations stay,
and every chart and formula over them recalculates. Your document is
the report; the file is the month.
