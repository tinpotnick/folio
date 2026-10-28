---
name: earlier-starts-first-contact
feature: Empty charts explain themselves; the Repay or invest? example starts trackers from 1975 (docs/specs/chart-rendering.md, docs/specs/data-import.md)
steps:
  - Open the "Repay or invest?" example and set the mortgage to start in January 1990, leaving it a 2-year fix.
  - Work out, without reading the formulas, why the charts have nothing on them and what to change so the model runs from 1990.
  - Make it run from 1990 and find when the loan would have been cleared.
expected:
  - Every plan chart reads "Nothing to show: no rows to plot ..." instead of an empty frame.
  - The "Assumptions check" directly under the assumptions says the 2-year fix data begins in January 1995 and that a tracker can start from January 1975.
  - Changing mortgage to tracker fills the charts from January 1990; the period table shows 300 months, and the loan is cleared in December 2014.
---
# First-contact eval: a start before the data

A homeowner tries their own mortgage's start year, 1990, earlier than
the fixed-rate data, and must find out why nothing shows and what does
work.
