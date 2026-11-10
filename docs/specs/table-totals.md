# Table totals rows

## Status: accepted (2026-11-10) - implemented on vibe/table-totals

## Decision

A dataset (`::: table`) may declare a **totals row** - a derived
footer rendered as `<tfoot>`, computed at render time and never
stored in `rows`. Charts, formulas, queries and the dataset browser
see only the real data rows; the totals row is display-only, like a
chart.

```
::: table {#invoice}
columns:
  - {name: item, type: text}
  - {name: qty, type: number, align: right}
  - {name: amount, type: formula, align: right, expr: "qty * price", format: currency}
data:
  - ["Workshop", 2, 450]
totals:
  - {col: qty, expr: "self.col.qty | sum()"}
  - {col: amount, expr: "self.col.amount | sum()"}
:::
```

## Rules

- `totals:` is a section of `{col, expr}` entries. `col` must name an
  existing column (parse error otherwise); `expr` is the same Jexl
  formula language as formula columns (spec: formulas.md), evaluated
  ONCE per table with the whole RECALCULATED table as `self`:
  `self.col.<name>` is that column's array of values, so
  `self.col.amount | sum()` is the folio spelling of sum(A1:A20).
  There is no current row in a totals row - anything but `self.col.*`
  under `self` is a visible error. Spreadsheet habits apply
  (`=sum(...)`, `20%`).
- The aggregate/transform catalog of formulas.md is available
  (`sum()`, `count()`, `mean()`, `min()`, ... and arithmetic on top:
  `self.col.amount | sum() * 0.2` for VAT). Empty/non-finite cells
  are skipped by the aggregates; a non-finite result renders empty
  (the reporting contract, ADR-0012).
- Rendering: one `<tfoot>` row. The first visible column without a
  total shows the label "Total"; each totals entry's cell shows the
  computed value formatted with its column's `format` (e.g.
  `currency`). Hidden columns are skipped (model indexes preserved).
  Footer cells are not editable.
- Errors (bad Jexl, unknown column at eval time) show as a
  `Totals error: ...` line above the table, like formula errors.
- Totals recompute whenever the table recalcs - editing a cell
  updates the footer in place (dependents, like charts).
- Simple (pipe) tables have no directive and cannot declare totals.
- The directive round-trips byte-identically; `totals` is a closed
  key set (`col`, `expr`) - unknown entry keys are parse errors.

## Example

`demo/examples/invoice.md`: an invoice with a formula column for
line amounts and a totals row summing qty and amount.
