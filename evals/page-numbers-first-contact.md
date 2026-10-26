---
name: page-numbers-first-contact
feature: page numbers and running header (docs/specs/print.md)
steps:
  - With a multi-page example open in dark mode, export or print it and check what the pages carry.
  - Turn the page numbers off without knowing any syntax, then check a printout again.
  - Turn them back on.
expected:
  - Every page says "Page n of N" at the bottom right; from page 2 the document's title is at the top left; page 1 has no header.
  - The pages are light paper with light-mode charts, even though the app is in dark mode.
  - The control is found from visible affordances (Document settings, or Ctrl+K "page numbers").
  - Turning numbers off removes them from the next printout; the source gains `page.numbers: "off"` and nothing in the text.
---
# First-contact eval: page numbers

A new user expects a printed report to have page numbers, and to be
able to turn them off.
