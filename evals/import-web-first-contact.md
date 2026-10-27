---
name: import-web-first-contact
feature: importing data from a web address, and money/date formulas (docs/specs/data-import.md, docs/specs/formulas.md)
steps:
  - In a new document, find how to import data without knowing any command names.
  - Import the Bank of England's Bank Rate history from its CSV address (https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2015&Dateto=now&SeriesCodes=IUMABEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N), keeping it cited.
  - Cite the dataset in a sentence, and chart it.
  - Build a small repayment table for a 250,000 loan at 4.5% over 25 years (monthly payment, and the balance after each of the first 12 months), using the help to find the functions.
expected:
  - Import is found from visible affordances (+ Insert › Import data…, or Ctrl+K "import").
  - Before importing, the preview shows the rows, the column types (the dates as dates), the publisher and the licence (Open Government Licence).
  - After importing, the table shows "Source: Bank of England (year)"; the References list holds the dataset with its retrieval date; a citation of its key reads in the document's style.
  - The payment reads 1389.58 (with -pmt or abs); the balance falls month by month; the source keeps plain formulas.
---
# First-contact eval: data from the web, and money formulas

A new user brings public data into a document and computes with it -
the start of a "repay or invest?" assessment.
