---
theme: academic
---

# Compiling expressions: notes

A technical folio document mixes prose, code, equations, and
measured data.

[[_TOC_]]

## The evaluator loop

The hot path is one function:

```ts
export function recalcTable(table: Table): Table {
  const rows = table.rows.map((row) => row.slice());
  // ... compute each formula column left to right
  return { ...table, rows };
}
```

## Cost model

Each recalculation walks every formula column once, in column
order, so chained formulas resolve in a single pass:

$$
C = \sum_{i=1}^{n} r_i \cdot f_c
$$

where *r* is the row count and *f_c* the cost per column.

::: table {#bench}
caption: "Recalc cost vs document size (milliseconds)"
columns:
  - {name: rows, type: number, align: right}
  - {name: columns, type: number, align: right}
  - {name: ms, type: number, align: right}
data:
  - [100, 4, 2]
  - [1000, 4, 18]
  - [10000, 4, 171]
:::

::: chart {#bench-chart}
source: @bench
query: {select: [rows, ms]}
type: bar
caption: "Recalc time by row count"
:::

Growth is linear in rows: recalculation is O(r·c), and the
structural sync is O(blocks) per keystroke.

## A mermaid pipeline

::: mermaid {#pipeline}
graph TD
  Parse --> Recalc
  Recalc --> Render
  Render --> SVG
:::

The parse stage is pure; the render stage is async for diagrams
and equations only.
