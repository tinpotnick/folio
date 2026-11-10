---
theme: technical
---

# Traffic on a small road network

*A mermaid diagram with `flow=@roads` is also a flow figure: the
packets play inside the diagram itself. The edges are an ordinary
dataset - edit a quantity and the flow follows. In print/PDF the
packets become trails over the diagram.*

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

The network as a diagram with traffic flowing through it - mermaid
lays the nodes out, `flow=@roads` animates the vehicles inside it:

::: mermaid {#net} flow=@roads
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

::: chart {#busiest}
source: @roads
query: {group: [from], agg: {out: sum(qty)}, sort: {by: out, order: desc}, limit: 5}
type: bar
caption: "Busiest origins by total flow"
:::

Print this document (or export PDF) and the vehicles become trails
over the diagram. A flow figure in its own block
(`::: motion` with `type: flow`) lays its nodes out on a circle and
offers the filmstrip/flowmap/poster renditions instead.
