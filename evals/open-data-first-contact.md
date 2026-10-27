---
name: open-data-first-contact
feature: Open data known sources and personal-use data (docs/specs/data-import.md)
steps:
  - Without knowing any series codes, bring the Bank of England's Bank Rate and the 2-year fixed mortgage rate since 2010 into a document, as one table.
  - Bring in UK share prices since 2000 from a source you may share.
  - Import a price history CSV you "downloaded from a finance site" (any small CSV of dates and closing prices), recording where it came from and that it is for personal use only; chart it.
  - Export or print the document.
expected:
  - Both open-data imports are found in + Insert › Import data… › Open data; the preview names the columns (bank_rate, fixed_2y; uk_shares), captions them from the series titles, and shows the licence (Open Government Licence; CC BY 4.0, with the note that share indices exclude dividends).
  - Each table shows its Source line; the References list holds each dataset with its retrieval date.
  - The downloaded file's table and its chart both say "Personal use only - not for sharing"; its reference says so; the source keeps `licence: "personal-use"`.
  - Print/Export reminds the user that the document contains personal-use data, naming it, without blocking.
---
# First-contact eval: open data, and personal-use data

A homeowner gathers the rates, prices and their own fund's history for
a "repay or invest?" document, knowing which parts they may share.
