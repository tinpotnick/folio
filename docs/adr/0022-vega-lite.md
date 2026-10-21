# ADR-0022: Vega-Lite charts, bound to folio datasets

Date: 2026-10-21

Status: accepted

## Context

folio's own charts (ADR-0004) cover bar, line, area, scatter, pie and
donut, now with several series. Heatmaps, layered charts and small
multiples are out of their reach, and growing the chart engine to
cover the whole grammar of graphics is not a goal. Vega-Lite is that
grammar, as JSON.

## Decision

A ```` ```vega-lite ```` block is a drawn figure
(docs/specs/drawn-blocks.md):

- **Datasets, not files**: `"data": {"name": "@dataset"}` (anywhere in
  the spec) is replaced by the dataset's live, recalculated rows, so a
  table edit redraws the chart. `"data": {"url": ...}` is REFUSED, and
  the Vega loader rejects every fetch: documents render offline
  (ADR-0005).
- **Headless SVG**: compiled with `vega-lite`, rendered by `vega` with
  the `none` renderer to an SVG string, then sanitized. No canvas, and
  print is identical.
- **Themed by config**: the theme becomes Vega-Lite's default
  `config` (font, ink, grid, palette, heatmap ramp, rules), which the
  spec's own `config` overrides.
- **Dependency**: `vega` 6 and `vega-lite` 6, BSD-3-Clause, actively
  maintained by the UW Interactive Data Lab. Lazy-loaded on the first
  Vega-Lite block. Vega expressions are parsed by its own expression
  language, so no `eval` is involved.

## Consequences

- Two more lazy chunks (the largest after Mermaid).
- Interactive Vega features (selections, tooltips) do not apply: the
  output is a static SVG, like every other figure.
