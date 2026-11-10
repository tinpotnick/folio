# Cross-filtering between figures

## Status: accepted (2026-11-10) - implemented on vibe/spec-next-features

## Decision

Charts over the same dataset are linked: clicking a category in one
figure filters all the others. This is the dashboard interaction folio
lacks - and it fits the model, because a filter is just a query filter
applied at render time.

Click a bar / pie slice / donut segment / heatmap cell (v1 category
charts: bar, pie, donut, heatmap) to select that category; click again
to clear. Selected categories stay highlighted in every linked chart;
non-matching marks dim. A chip row above each linked chart shows the
active filters ("status = done ×"); clicking × clears that one.

## Rules

- **Linking**: charts sharing the same `source: @table` are linked by
  default. A chart may opt out with `crossfilter: off` on the
  directive. Linking is by the SOURCE TABLE, so a table cell edit
  ripples through all linked charts as today.
- **Semantics**: within one chart, multiple selected categories are OR
  (`status == "done" || status == "doing"`); across different charts
  they are AND (status filter AND owner filter). The applied filter is
  the conjunction of the per-chart ORs, shown as chips per chart.
- **Which mark**: the category is the first group/select column of
  the chart's query (for grouped queries, the first group column).
  Scatter/line points are not selectable in v1 (no category).
- **View-only state**: active filters are view state, never written to
  the document (like the dataset browser's sort) - the document
  round-trips unchanged, print/PDF always shows unfiltered data unless
  the block's own `query.filter` says otherwise. Reload clears them.
- Charts without a category axis (line/area over a numeric x) still
  RECEIVE filters but have no click target.
- Filter chips render in the chart figure's header area, one per active
  filter, with × to clear; Esc clears all. The one-inspector contract
  is untouched (chips are not an inspector).
- Empty result after filtering: the chart shows its normal empty
  state; chips stay so the filter can be cleared.

## Example

The r/datavisualization example: click a flair bar in #flair-mix and
the histogram and heatmap filter to that flair.
