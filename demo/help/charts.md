# Charts

A chart is a **query over a table**, written in the Markdown source.
The figure renders from the table's current data — edit the table
and the chart updates on the next render. The directive looks like
this:

```
::: chart {#growth-chart}
source: @regional-data
query: {select: [region, growth], sort: {by: growth, order: desc}}
type: bar
caption: "Quarter-on-quarter growth by region"
:::
```

- The quickest way to a chart: click a dataset and press **Chart
  it** on its bar, or search "chart" in the palette (the chart goes
  where your cursor is). You get a bar chart of its first text and
  first number column, split by another text column when the labels
  repeat, which you can then change on the chart's own bar, or in
  the source below.
- **source** points at a table by its anchor id (`@regional-data`).
- **query** has three parts, all optional except `select`.
- **query: select** `[column, column]` names the columns to plot.
  The first selected column labels the bars; the last is the value.
- **query: filter** `"q2 > 350 && region != 'South'"` is a **Jexl
  expression** over the table's columns (the same language as table
  formulas; text columns included). The legacy form
  `filter: {column: q2, op: gt, value: 0}` (operators `eq`, `gt`,
  `lt`) still works.
- **query: sort** `{by: growth, order: desc}` sorts by a column,
  `asc` or `desc`.
- **type** is `bar`, `line`, `area`, `pie`, `donut`, or
  `scatter`. Bar/line/area plot the first selected column as
  the category label and the last as the value; pie and donut
  slice by the value (non-negative data only — a negative shows
  as the chart's error text); scatter plots the first selected
  column as x and the last as y, both numeric.
- **caption** is the figure caption.

**Several series**: select more than one value column
(`select: [month, revenue, cost]`) for grouped bars or several lines,
or split one value by a column with `series: region` (one line or
bar per region). Add `stack: true` for stacked bars or stacked
areas. In the
chart's bar these are **Split by** and **Stack**. A legend appears
under the chart.

Charts label values the way the table does: a `format: percent`
column reads `21.6%` on the chart too. Chart colors come from the
theme. To pick a palette yourself, set
`chart.palette` in the style header: `muted`, `corporate`, `ink`,
`warm`, `sepia`, `vivid`, `news`, `jewel`, `mono`, or `swiss`. Each
has a matching set for dark mode.

- Charts are not widgets — they are queries over a table. Edit the
  table and the figure updates on the next render. There is no run
  button anywhere in folio, and no execution state.
- **A chart says "Nothing to show"** when its query leaves no rows (a
  filter that matches nothing, an empty table) or every value is
  blank. Check the filter in its inspector bar, or the table it reads -
  in a model, an assumption outside its data often blanks every row.
