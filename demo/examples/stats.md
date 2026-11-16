---
theme: newsroom
---

# folio's own numbers

This document is folio's own GitHub repository rendered by folio: a
typed table snapshotted from the API, charts as queries over it, no
run button. GitHub keeps only the last 14 days of traffic, so a
nightly workflow (`.github/workflows/stats.yml`) appends each day to
the history below - the trend outlives the API's window. The document
is a static snapshot and renders fully offline.

## Daily traffic

::: table {#traffic}
caption: "Page views and clones per day (GitHub traffic API, snapshotted nightly)"
columns:
  - {name: date, type: date, align: right}
  - {name: views, type: number, align: right}
  - {name: views_uniques, type: number, align: right}
  - {name: clones, type: number, align: right}
  - {name: clones_uniques, type: number, align: right}
data:
  - [2026-11-01, 25, 1, 206, 24]
  - [2026-11-02, 48, 1, 178, 40]
  - [2026-11-03, 29, 14, 111, 34]
  - [2026-11-04, 32, 21, 109, 31]
  - [2026-11-05, 17, 16, 5, 5]
  - [2026-11-06, 39, 29, 45, 12]
  - [2026-11-07, 39, 34, 3, 3]
  - [2026-11-08, 35, 23, 1, 1]
  - [2026-11-09, 18, 7, 86, 22]
  - [2026-11-10, 59, 9, 254, 38]
  - [2026-11-11, 5, 3, 222, 57]
  - [2026-11-12, 20, 5, 75, 25]
  - [2026-11-13, 5, 2, 3, 3]
  - [2026-11-14, 6, 5, 17, 8]
:::

::: chart {#views-chart}
source: @traffic
query: {select: [date, views], sort: {by: date, order: asc}}
type: line
caption: "Page views per day"
:::

::: chart {#clones-chart}
source: @traffic
query: {select: [date, clones], sort: {by: date, order: asc}}
type: line
caption: "Clones per day (mostly CI)"
:::

## Release downloads

::: table {#downloads}
caption: "Downloads per release, all assets (dnf installs included via the .rpm)"
columns:
  - {name: release, type: text, width: 20}
  - {name: published, type: date, align: right}
  - {name: downloads, type: number, align: right}
data:
  - ["v0.1.1", 2026-10-23, 32]
  - ["v0.1.2", 2026-10-26, 14]
  - ["v0.2.0", 2026-11-01, 3]
  - ["v0.2.2", 2026-11-02, 9]
  - ["v0.2.1", 2026-11-02, 8]
:::

::: chart {#downloads-chart}
source: @downloads
query: {select: [published, downloads], sort: {by: published, order: asc}}
type: bar
caption: "Downloads per release, oldest first"
:::
