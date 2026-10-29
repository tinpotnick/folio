# Python on your data

- A code block tagged `python` is ordinary code, exactly as on GitHub.
  It **runs** when its fence says what it reads and what it publishes:
  ```` ```python data=@takings out=fit,slope ````. Or use the block's
  header: pick a dataset in its **data** picker, and tick variables
  under **Publish**.
- **Data in**: `data=@takings` gives the script a variable `takings` -
  the table's rows, each a dict by column name. `takings[2]["takings"]`
  is a cell (Python counts rows from 0), `takings.col("day")` a whole
  column, `takings.columns` the column names.
- **Data out**: each variable named in `out=` becomes an `@name` the
  document uses like its own tables. A list of rows (dicts), or a dict
  of columns, becomes a dataset - `source: @fit` in a chart, or
  `@fit.r3.trend` in a formula. A single number, text or date becomes
  a value - `@slope * 30` in a formula. Other variables stay inside the
  script.
- The block always shows its code. One line under it says what it
  published - `→ @fit (14 rows) · @slope = 8.56` - and a dataset there
  opens in the dataset browser. An error shows there too, with its
  line number.
- No run button: a script runs again a moment after you edit it, and
  when a table it reads changes. Its results are saved in the document,
  so charts appear straight away, even before Python has loaded.
- A script can read another's results: `data=@fit,@slope`.
- The script runs sealed off - no network, no files - for at most ten
  seconds. Python (Pyodide) loads only when a document has a Python
  block.
