---
name: multi-series-first-contact
feature: several series in a chart (docs/specs/chart-rendering.md)
steps:
  - Open the imported data report; find a chart showing every region.
  - Open the accounts example; turn the half-by-half chart into a
    stacked bar without editing the source.
  - On any line chart over a table with a category column, show one
    line per category.
expected:
  - A chart with a line per region and a legend naming them.
  - The chart bar's Stack box stacks the bars, with totals on top.
  - The chart bar's Split by picks the column; a legend appears.
---
