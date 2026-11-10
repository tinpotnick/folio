---
theme: technical
---

# Traffic on a small road network

*A flow figure plays packets travelling an edge list. The edges are
an ordinary dataset - edit a quantity and the flow follows. With
`diagram: @net` the figure animates inside the mermaid diagram itself:
the diagram's own SVG is the base and the packets move through it. In
print/PDF the default rendition is a static flow map: one map, edge
widths proportional to total flow.*

::: table {#roads}
caption: "Edges of a little road network (qty = vehicles per edge, speed = relative pace: an edge is crossed in 30/speed ticks)"
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

The network as a diagram - mermaid lays the nodes out, and the figure
below animates inside that very diagram:

::: mermaid {#net}
graph LR
  Market --> Square
  Square --> Market
  Square --> Station
  Station --> Square
  Market --> Park
  Park --> Station
  Square --> Park
  Station --> Docks
  Docks --> Station
  Park --> Docks
:::

::: motion {#traffic}
type: flow
source: @roads
diagram: @net
frames: 48
caption: "Vehicles per tick moving through the network diagram above"
:::

::: chart {#busiest}
source: @roads
query: {group: [from], agg: {out: sum(qty)}, sort: {by: out, order: desc}, limit: 5}
type: bar
caption: "Busiest origins by total flow"
:::

Print this document (or export PDF) and the flow figure becomes the
flow map - `print: filmstrip` would give the frames as thumbnails
instead, `print: trails` each packet's path over the diagram, and
`display: flowmap` shows the static map in the document itself. A flow
figure without `diagram:` lays its nodes out on a circle.
