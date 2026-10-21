---
name: math-functions-first-contact
feature: math function catalog (formulas.md "Math function catalog")
steps:
  - Start the demo host. Open the *Signals and spectra* example
    (command palette, "Open example: Signals and spectra").
  - In Document view, confirm the time-domain line chart, the two
    frequency-domain bar charts, and the equations render, and
    that the signal table's `mag` column peaks at 32 on the 5 Hz
    row and 19.2 on the 20 Hz row.
  - Switch to Markdown view and change the second tone in the
    `sig` formula from `20` to `12`.
  - Switch back to Document view.
  - In Markdown view, add a formula column to any small table
    with `expr: "sin(pi)"`, then change it to
    `self.col.q2 | mean()` (with a numeric `q2` column).
  - In the same table, set a formula to `self.col.q2 | fft()`
    (a bare array) and to `self.col.nope | sum()`.
expected:
  - The spectrum charts move their peaks to 12 Hz (and the
    mirrors to 52 Hz) and every dependent column - `re`, `im`,
    `mag`, `fftmag`, `lp`, `lpmag` - recalculates; `mag` reads
    19.2 on the 12 Hz row.
  - `sin(pi)` shows 0; `self.col.q2 | mean()` shows the column's
    mean for every row, skipping empty cells.
  - A bare `fft()` result renders empty (it must be indexed with
    `at(k)`), and `self.col.nope` reports "unknown column 'nope'"
    by name.
---
