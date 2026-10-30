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
  - Click the formula column's cell in the first row and check
    the formula bar shows the formula (`v * 2`).
  - Click the first cell of the first row, type a new value, and
    press Enter; leave the browser with the ✕ button (or Escape)
    and confirm the document scrolled back to the table.
  - Click a cell of the sample document's regional-data table,
    then the grid button at the left of the inspector bar.
expected:
  - The figure shows the first 50 rows and a status line reading
    "120 rows x 3 columns - showing first 50" - not a frozen
    page; the document flows normally around it.
  - The dataset opens as a full-screen spreadsheet view (no modal
    card, no dimmed backdrop), its toolbar naming "@big" and the
    section it lives in; rows are numbered; all 120 rows are
    scrollable instantly and the count reads "120 rows"; scrolling
    to the bottom shows the last rows without loading.
  - The filter narrows to the matching rows ("4 rows of 120 -
    filtered"); a typo'd column shows a visible error.
  - Sorting toggles asc/desc in the header; the count reports
    it, and the table in the document is unchanged.
  - Selecting the computed cell shows `v * 2` in the formula bar.
  - The edit lands in the document table, recalculates the
    formula column, and appears in the Markdown source; ✕ or
    Escape closes the view and returns to the table's figure in
    the document.
  - The inspector's grid button opens the same browser for
    regional-data ("@regional-data", 3 rows).
---
