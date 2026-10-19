---
name: formulas-first-contact
feature: formulas
steps:
  - Start the demo host. Switch to Markdown view and add a small
    table with a numeric column and a formula column, e.g.
    a months table with `q2` values and a formula column
    `total` with `expr: "q2 + (self.row == 1 ? 0 : self.prev.total)"`.
  - Switch to Document view.
  - Click a `q2` cell and change its number; press Tab.
  - Back in Markdown view, add a second small table with id
    `budget` and change the formula to
    `q2 - @budget.r1.target` (with a `target` column).
  - Switch to Document view; edit the budget's `target` cell.
expected:
  - The running-total column shows cumulative values and updates
    for every row below the edited one, live.
  - The cross-table formula shows the difference against the
    budget row and updates the moment the budget cell changes.
  - Errors are visible by name: an unknown column, a later formula
    column, a hyphenated table id, and a circular reference each
    report a clear message rather than a wrong number.
---
