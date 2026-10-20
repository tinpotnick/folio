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
- **Value labels**: a sparse series (<= 12 points) labels every
  point; a dense one labels only its maximum, minimum, and last
  point (bold) - the extremes are the story.
- **Markers**: a sparse line/area series (<= 64 points) draws a
  marker on every point; a dense one draws markers only at the
  x-tick positions - a marker per point on a 512-sample curve is
  a bead necklace, not a line. The polyline always covers every
  point.
- **Axis titles**: the y axis names the query's value column
  (with its table unit, e.g. `revenue (£k)`), the x axis names
  the category column. A chart explains itself.
- **Chart identity**: a chart figure is its BLOCK, not its source
  table - several charts may plot different queries over the same
  table (the signal demo plots four). Figures carry a positional
  `data-block-index`; `drawChart` resolves the block by that
  index, never by source alone.
- **Theme dressing**: the series color and the pie slice palette
  come from the document's `chart.palette` theme key (passed from
  `drawChart` via `ChartStyle`); the renderers stay pure and
  default to folio blue. Each chart ROTATES through the palette
  by its position among the document's chart blocks - the second
  chart on a page never wears the first chart's color, so same-
  shaped figures stay distinguishable.
- **Line and area charts** carry a soft gradient fill hugging the
  curve (unique gradient id per chart - several charts share a
  page); area fills to the zero baseline, the line's fill is a
  whisper.
- **Negative domains** keep the zero baseline visible; pie/donut
  reject negative values (the error contract).
- SVG classes are part of the test surface: `.x-tick`, `.v-label`,
  `.tick-y`, `.axis-title`.

## Acceptance

- Unit: `tests/render/chart.test.ts` (16 tests: domain rules,
  thinning, sparse/dense labeling, axis titles, style colors,
  unique gradients).
- e2e: the report example's 24-month charts assert thinned ticks,
  sparse labels, and axis titles (`tests/e2e/demo-data.spec.ts`).
