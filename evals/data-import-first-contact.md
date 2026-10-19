---
name: data-import-first-contact
feature: data-import
steps:
  - Start the demo host. Open the command palette (Ctrl+K) and run
    "Import the demo dataset (monthly-sales.csv)" - no file dialog
    needed.
  - Open the example "Open example: report" to see the finished
    shape of an imported-data document.
  - Open the palette again and run "Import data from a file
    (CSV or JSON)" with the shipped `demo/data/site-metrics.json`.
  - Pick a CSV file with a header row and a few hundred rows.
  - Look at the inserted table in the document view, then open
    the dataset browser from its status line.
  - Switch to the Markdown source view.
  - Add a formula column to the imported table (a chart over it
    also works the same way).
expected:
  - The file becomes a typed table right after the caret (or at
    the document's end); numeric columns are typed `number`.
  - A table longer than the window shows the head rows plus a
    "N rows x M columns - showing first 50" line; the dataset
    browser browses and filters every imported row.
  - The Markdown source shows the whole dataset inside a table
    directive with `import: "thefile.csv"` recording provenance -
    one file, offline, no live link.
  - Formulas and charts over the imported table behave exactly
    like over hand-authored tables.
  - A bad file shows "Import failed: ..." and leaves the document
    untouched.
---
