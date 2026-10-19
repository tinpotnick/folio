---
name: dataset-browser-first-contact
feature: dataset-browser
steps:
  - Start the demo host. Switch to the Markdown view, replace the
    document with one holding a table of 120 rows, and switch
    back to the document view.
  - Look at the table figure, then click its "Open dataset"
    button.
  - Type `v > 115` in the browser's filter box.
  - Click the `v` column header twice.
  - Click the first cell of the first row, type a new value, and
    press Enter; press Escape to leave the browser.
  - Click a cell of the sample document's regional-data table,
    then the grid button at the left of the inspector bar.
expected:
  - The figure shows the first 50 rows and a status line reading
    "120 rows x 3 columns - showing first 50" - not a frozen
    page; the document flows normally around it.
  - The browser opens instantly with all 120 rows scrollable,
    and the count reads "120 rows"; scrolling to the bottom
    shows the last rows without loading.
  - The filter narrows to the matching rows ("4 rows of 120 -
    filtered"); a typo'd column shows a visible error.
  - Sorting toggles asc/desc in the header; the count reports
    it, and the table in the document is unchanged.
  - The edit lands in the document table, recalculates the
    formula column, and appears in the Markdown source; Escape
    closes the browser.
  - The inspector's grid button opens the same browser for
    regional-data ("@regional-data", 3 rows).
---
