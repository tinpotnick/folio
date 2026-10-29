# Python on your data

- A code block tagged `python` is inert code, exactly as on GitHub.
  What makes it **run** is a binding on the fence:
  ```` ```python data=@budget out=forecast ```` — or pick the
  dataset in the block's header (the **data** picker). The script
  reads the dataset as a variable named after it (here `budget`, a
  list of dicts keyed by column name) and returns a table, which
  becomes the dataset `@forecast` — a dataset like any other, so
  charts, formulas and other compute blocks can read it.
- Several datasets and several outputs: ```` ```python
  data=@budget,@rates out=forecast,sensitivity ```` — each dataset
  is its own variable, and the script returns one table per output
  name, as a tuple (`return months, warn`).
- A return is a list of dicts (columns inferred from the first
  row), or `{columns, rows}` naming columns, types and units
  explicitly.
- The output **is** the figure: no run button, no execution chrome.
  Editing the data or the code recalculates it a moment after you
  stop typing, and errors show as the figure's text. The script
  runs sealed off — no network, no files — and at most ten seconds.
- The Python runtime (Pyodide) loads once, only when a document has
  a compute block; documents without one pay nothing.
