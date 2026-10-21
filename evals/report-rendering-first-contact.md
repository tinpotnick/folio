---
name: report-rendering-first-contact
feature: table layout, computed display, chart axes (docs/specs/table-inspector.md "Layout", docs/specs/formulas.md "Display", docs/specs/chart-rendering.md)
steps:
  - Start the demo host. Open the palette and open the "Signals and
    spectra" example; look at the first table.
  - Open the "Management accounts" example and look at both charts.
  - Open the imported data report example and look at the two line
    charts.
  - Narrow the window to phone width and look at the toolbar.
expected:
  - The ten-column signal table stays inside the page and scrolls
    sideways within it; numbers are right-aligned and computed
    values show at most six decimals.
  - Percent columns chart as percentages (21.6%, -15.3%), y ticks
    fall on round steps, and no value label overlaps an axis label.
  - Line fills shade BELOW each line; end-of-series labels do not
    overlap one another.
  - The page never scrolls sideways; the toolbar scrolls within its
    own row and every button is reachable.
---
