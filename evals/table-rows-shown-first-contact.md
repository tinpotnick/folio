---
name: table-rows-shown-first-contact
feature: Rows shown per table (docs/specs/dataset-browser.md, "Rows shown, per table")
steps:
  - Open the "An imported data report" example (palette: "Open example: An imported data report").
  - Make its long table show only its first 10 rows in the page, without changing the document's other tables.
  - Check that its chart still plots every row.
  - Then make the same table show every row, and finally put it back to the document's default.
expected:
  - Clicking the table shows a "Rows" picker on its bar; searching "rows shown" in Ctrl+K finds "Choose how many rows a table shows" and opens it.
  - Picking 10 shows ten rows and a "… showing first 10" line; other tables are unchanged; the chart is unchanged.
  - The Markdown source gains `show: 10` on that table; "all" writes `show: all` and shows every row; "default" removes the key.
---
# First-contact eval: rows shown per table

A user wants one long table to take less room in their report, while
its figures still use all the data.
