---
name: compute-first-contact
feature: Compute blocks (docs/specs/compute-blocks.md, ADR-0030)
steps:
  - From the welcome page, open the "Coffee forecast" example.
  - Change a day's takings in the sales table and watch the trend chart, the growth table and the projection follow.
  - Find out how much the takings grow per day, and where that number comes from.
  - In any document with a dataset, add a Python block that publishes the number of rows, and use that number in a formula column of another table - without reading docs.
expected:
  - Each Python block shows its code, with one line under it naming what it published (`→ @fit (14 rows) · @slope = …`); no output tables are drawn by the blocks themselves. No run button anywhere.
  - Editing a bound dataset runs the scripts again; charts and the formula over @slope follow with no further action.
  - Clicking @fit in the status line opens it in the dataset browser.
  - Ctrl+K "python"/"compute" finds Insert a compute block (Python); its header offers Publish tick-boxes; a formula `@name * 2` reads the published value.
---
# First-contact eval: Python on your data

A shop owner fits a trend in Python and uses its results in the
report's charts and tables, without learning a notebook.
