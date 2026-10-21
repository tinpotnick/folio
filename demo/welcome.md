---
theme: modern
---

# folio

Documents that calculate like a spreadsheet and read like a finished
report.

folio is a document-first workspace. You write in plain Markdown;
tables are typed datasets with live formulas; charts are queries over
those tables; and the page always renders like a polished report - in
ten themes, light or dark, online or off.

## Try it on this page

This page is itself a folio document, and the table below is live.
Click a cost and change it: the share column recalculates, and the
chart redraws from the same data.

::: table {#launch-budget}
caption: "A small launch budget"
columns:
  - {name: item, type: text, width: 30}
  - {name: cost, type: number, unit: "£k", align: right}
  - {name: share, type: formula, expr: "cost / (self.col.cost | sum())", format: percent, align: right}
data:
  - [Engineering, 30]
  - [Design, 12]
  - [Marketing, 9]
  - [Launch event, 6]
:::

::: chart {#launch-chart}
source: @launch-budget
query: {select: [item, cost], sort: {by: cost, order: desc}}
type: donut
caption: "Where the budget goes"
:::

## What it is

- **A document, not a notebook.** There are no cells to run and no
  kernel to restart. Numbers stay correct because the document
  recalculates itself as you type.
- **Plain Markdown underneath.** Every document is one readable text
  file. Press the M↓ button to see and edit the source; nothing is
  hidden in a binary format.
- **Style lives in themes, never in the text.** You write headings,
  tables and figures; the theme decides fonts, colors, table rules
  and chart palettes. Change the theme and the whole document
  changes with it.
- **Yours, offline.** Every font, sound and library ships with the
  app. A document never needs the network to render.

## What it can do

- **Tables two ways**: a plain Markdown table that GitHub shows as
  is, or a **dataset** with typed columns, units in the headers, and
  formulas that reach across rows and other tables. One click turns
  a table into a dataset.
- **Charts as queries**: bar, line, area, scatter, pie and donut,
  filtered and sorted with the same expression language as formulas.
- **Equations, code and diagrams**: LaTeX math, syntax-highlighted
  code, and Mermaid diagrams, all rendered in the page.
- **Images and audio** embedded in the document itself, including
  recordings straight from the microphone.
- **Music**: Strudel patterns that play right in the page.
- **Ten themes**, each with its own dark mode: search "theme" in the
  command palette.
- **Print and PDF** that look like a report, not a web page.

## Example documents

Each one opens in place; the folio wordmark brings you back here.

- [Q3 Field Operations Review](demo/examples/field-operations.md) - a
  quarterly report with live regional figures, running totals and
  charts.
- [Management accounts](demo/examples/accounts.md) - formulas,
  budgets and a chart that shows a decline.
- [An imported data report](demo/examples/report.md) - 72 rows of
  imported data, windowed tables and line charts.
- [A technical paper](demo/examples/technical.md) - equations, code
  and diagrams.
- [Signals and spectra](demo/examples/signal-processing.md) - a
  sampled signal, its FFT and a low-pass filter, every number a
  formula.
- [A music document](demo/examples/music.md) - Strudel patterns that
  play in the page.
- [Amensister](demo/examples/amensister.md) - a Strudel classic built
  on an amen break, with online samples you choose to download.
- [A pure-prose poem](demo/examples/poem.md) - typography only, no
  data at all.

## Getting around

- **Ctrl+K** opens the command palette. Search for what you want in
  your own words: "table", "theme", "print", "dark".
- **?** opens the help document.
- **The M↓ button** switches to the Markdown source and back.
