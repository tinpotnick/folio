---

name: table-totals-first-contact
feature: table-totals
steps:

- Open the demo host on the invoice example (palette: "Open example:
  Invoice 2026-041").
- See the line items with the formula column (amount = qty * price)
  and the totals row at the bottom: "Total", summed qty and a
  currency-formatted amount.
- Click the qty cell of a line, change 12 to 20, Tab: the line's
  amount and the totals row update in place.
- Open the spend chart on the same table: it plots only the three
  line items - the totals row is not data.
- In the Markdown view, add a totals entry for VAT
  (`{col: price, expr: "self.col.amount | sum() * 0.2"}`) and watch
  the footer grow it; a bad expr shows a "Totals error:" line.
  expected:
- A dataset with a `totals:` section renders a <tfoot> row labelled
  "Total" with computed cells formatted per column; edits to data
  cells recompute it live; charts/queries exclude it; broken exprs
  are a visible error, not a crash; the directive round-trips.
