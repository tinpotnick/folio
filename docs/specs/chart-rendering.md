# Chart rendering

## Status: accepted (2026-10-20)

## Decision

Charts are static SVG (ADR-0004) rendered from `executeQuery`
output by `src/render/chart.ts`. The contract for dense data:
**a chart never clutters** - it thins.

## Contract

- **Tick thinning**: at most eight x tick labels (plus the last
  point, always labeled). A 24-month series shows 7 labels, not
  24 clumped ones.
- **Y ticks on nice steps**: the step is 1, 2, 2.5 or 5 x 10^n,
  aiming at about four intervals; the grid runs from a whole step
  at or below the minimum to one at or above the maximum, and zero
  is always a tick. No quarters of an arbitrary range (0.18 / 0.05
  / -0.07).
- **Value formats**: when the value column has `format: percent`,
  ticks and value labels read as percentages (`20%`, `21.6%`),
  matching the table. A chart never shows 0.22 beside a table
  that says 22%.
- **Value labels**: a sparse series (<= 12 points) labels every
  point; a dense one labels only its maximum, minimum, and last
  point (bold) - the extremes are the story. Labels never
  collide: a label that would overlap another gives way (the last
  point wins, then the extremes). A dense minimum hangs its label
  BELOW the point; on the plot's floor, where the x ticks live, it
  sits BESIDE the point instead. A negative bar's label hangs under
  the bar; when that would hit the x tick labels, the floor drops
  one step to make room.
- **Markers**: a sparse line/area series (<= 64 points) draws a
  marker on every point; a dense one marks only the points it
  labels (high, low, latest) - a marker per point on a 512-sample
  curve is a bead necklace, and markers at the tick months (the
  rule until 2026-10-27) read as data points that matter. The
  polyline always covers every point.
- **Dated x axes**: when every label is an ISO date, ticks read as
  the span needs - the year over three years or more, "Mar 2024"
  over one, the date itself within a year - and the last tick of a
  long axis is anchored at its end so it stays inside the chart. A
  regular tick closer than half a step to the always-labelled last
  point is dropped, so two labels never overlap.
- **Axis titles**: the y axis names the query's value column
  (with its table unit, e.g. `revenue (£k)`), the x axis names
  the category column. A chart explains itself.
- **Chart identity**: a chart figure is its BLOCK, not its source
  table - several charts may plot different queries over the same
  table (the signal demo plots four). Figures carry a positional
  `data-block-index`; `drawChart` resolves the block by that
  index, never by source alone.
- **Theme dressing**: the series color and the pie slice palette
  come from the theme's palette, or from the document's
  `chart.palette` key when set, using the set for the current mode
  (docs/specs/dark-light-mode.md). Axis ink, ticks and grid take
  the theme's ink, muted and hairline colors; pie seams and the
  donut hole take its paper. Everything passes from `drawChart` via
  `ChartStyle`; the renderers stay pure and default to light-paper
  constants. Chart text inherits the theme's text face. A pie or donut slice takes the color of its CATEGORY's position in the source table (`colorKeys`), so an edit that re-sorts the slices never swaps their colors. Each chart ROTATES through the palette
  by its position among the document's chart blocks - the second
  chart on a page never wears the first chart's color, so same-
  shaped figures stay distinguishable.
- **Line and area charts** carry a soft gradient fill hugging the
  curve (unique gradient id per chart - several charts share a
  page); area fills to the zero baseline, the line's fill is a
  whisper that hangs BELOW the curve to the plot's floor. (An
  earlier version closed the polygon at the highest point, which
  shaded ABOVE the line.)
- **Negative domains** keep the zero baseline visible; pie/donut
  reject negative values (the error contract).
- SVG classes are part of the test surface: `.x-tick`, `.v-label`,
  `.tick-y`, `.axis-title`.

## Several series (2026-10-21)

A bar, line or area chart can draw several series, in two ways that
both run through the query (filter and sort apply):

- **Several value columns**: `select: [month, revenue, cost]` gives
  one series per value column, named after it. (Before this, only the
  LAST column was plotted; no shipped document relied on that.)
- **A split-by column**: `series: region` with `select: [month,
  revenue]` gives one series per distinct region, in first-appearance
  order, for long (imported) tables. Repeated category/series pairs
  sum; a missing pair is a gap, not a zero.

`stack: true` stacks bars (positives up from zero, negatives down;
each stack labelled with its total) and areas (each band on the
series below). Without it, bars are grouped side by side and areas
overlap. Lines never stack, and break at gaps. A legend (HTML, under
the chart) names the series in palette order. With several value
columns the y axis shows only their shared unit. Pie, donut and
scatter keep their first series. The engine half is
`chartSeries()` (`src/engine/series.ts`, UI-free); the drawing is
`renderSeriesChart()`.

The chart bar has **Split by** (a column, or none) and **Stack**.

## Acceptance

- Unit: `tests/engine/series.test.ts` (both series forms, gaps,
  filter/sort, `series:`/`stack:` round-trip); `chart.test.ts`
  "several series" (grouped, stacked totals on the axis, lines broken
  at gaps, stacked areas, legend).
- e2e: `tests/e2e/multi-series.spec.ts`.
- Unit: `tests/render/chart.test.ts` (domain rules, nice ticks,
  percent formats, label collisions and floor placement, negative
  bar label clearance, line fill below the curve, thinning,
  sparse/dense labeling, axis titles, style colors, unique
  gradients).
- e2e: the report example's 24-month charts assert thinned ticks,
  sparse labels, and axis titles (`tests/e2e/demo-data.spec.ts`).
