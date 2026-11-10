---
theme: ledger
---

# Invoice 2026-041

*Line amounts are a formula column (`qty * price`); the bottom row is
a **totals row** - derived, not stored: `self.col.amount | sum()` is
the folio spelling of sum(A1:A20). Edit a quantity and the total
follows; charts and queries still see only the real line items.*

::: table {#invoice}
caption: "Invoice 2026-041 - Babblevoice Ltd, 2026-11-09"
columns:
  - {name: item, type: text}
  - {name: qty, type: number, align: right}
  - {name: price, type: number, align: right, format: currency}
  - {name: amount, type: formula, align: right, expr: "qty * price", format: currency}
data:
  - ["Discovery workshop", 2, 450]
  - ["Implementation days", 12, 620]
  - ["Support retainer (Nov)", 1, 900]
totals:
  - {col: qty, expr: "self.col.qty | sum()"}
  - {col: amount, expr: "self.col.amount | sum()"}
:::

VAT at 20% on the total: a totals expr is ordinary Jexl over the
whole column, so it can do arithmetic too - add
`{col: price, expr: "self.col.amount | sum() * 0.2"}` to see it in
the price column. A chart over the same table plots the line items
only - the totals row is never data:

::: chart {#spend}
source: @invoice
query: {select: [item, amount]}
type: bar
caption: "Spend per line item"
:::
