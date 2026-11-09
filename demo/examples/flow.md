---
theme: technical
---

# Traffic on a small road network

*A flow figure plays packets travelling an edge list. The edges are
an ordinary dataset - edit a quantity and the flow follows. In
print/PDF the default rendition is a static flow map: one map, edge
widths proportional to total flow.*

::: table {#roads}
caption: "Edges of a little road network (qty = vehicles per tick, speed in edge-lengths per tick)"
columns:
  - {name: from, type: text}
  - {name: to, type: text}
  - {name: qty, type: number, align: right}
  - {name: speed, type: number, align: right}
data:
  - [Market, Square, 9, 1]
  - [Square, Market, 6, 1]
  - [Square, Station, 7, 1.4]
  - [Station, Square, 5, 1.4]
  - [Market, Park, 3, 0.8]
  - [Park, Station, 4, 0.8]
  - [Square, Park, 5, 1.1]
  - [Station, Docks, 6, 1.6]
  - [Docks, Station, 2, 1.6]
  - [Park, Docks, 3, 0.9]
:::

::: motion {#traffic}
type: flow
source: @roads
frames: 48
caption: "Vehicles per tick moving along the edges"
:::

::: chart {#busiest}
source: @roads
query: {group: [from], agg: {out: sum(qty)}, sort: {by: out, order: desc}, limit: 5}
type: bar
caption: "Busiest origins by total flow"
:::

Print this document (or export PDF) and the flow figure becomes the
flow map - `print: filmstrip` would give the frames as thumbnails
instead, and `display: flowmap` shows the static map in the document
itself.
