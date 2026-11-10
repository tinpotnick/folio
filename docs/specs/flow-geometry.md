# Flow-figure geometry: the diagram is the layout

## Status: accepted (2026-11-10) - implemented on vibe/flow-in-diagram

## Decision

Node locations live in the **diagram**, not in a table. A mermaid
block with a `flow=@edges` opener attribute is also a flow figure:
mermaid lays the nodes out (block and direction are the author's
choice - `graph LR`, `flowchart TD`, ...), and the packets animate
**inside the diagram's own SVG**. There is one figure, not two.

```
::: mermaid {#net} flow=@roads
graph LR
  Market --> Square
  ...
:::
```

The edge table remains the single source of truth for DATA
(`from, to, qty, speed` - frames are still ordinary table rows).
Mermaid provides structure + positions only. Every edge/node in the
table must exist in the diagram, else a visible error. A `::: motion`
block with `type: flow` and no diagram stays as-is: circle layout,
own SVG, filmstrip/flowmap/poster renditions.

## Rules

- The mermaid directive opener takes optional attributes:
  `flow=@table` binds an edge list. Unknown attributes are a parse
  error. Round-trips byte-identically.
- The mermaid SVG's viewBox becomes the figure's width/height, so the
  player, filmstrip, poster/frame and trails share the diagram's
  coordinate space (`MotionData.baseSvg` carries the diagram; frame
  groups are injected before its `</svg>`).
- Screen: the diagram with its own edges hidden and redrawn
  qty-weighted (log scale, cap 16) plus the moving packets (up to 16
  per edge), autoplaying in a loop at 15 fps - the figure hosts the
  player, so the rendition CSS and playback are the motion figure's.
  Print/PDF: trails over the diagram (a still cannot play).
- Node ids in the mermaid text must be simple (letters/digits/dash/
  underscore) and match the edge table's from/to values - mermaid
  rewrites anything else. Positions are extracted from the rendered
  SVG's node groups (`<renderId>-flowchart-<id>-<n>`, rect centred on
  the translate); pinned via the `^12.2.0` dependency and fixture unit
  tests. A diagram with no flowchart nodes is a visible error.
- Editing the edge table or the diagram text redraws the figure in
  place (dependents, like charts).
- Engine stays pure: it stores the raw text + the `flow` reference.
  Mermaid runs in the component (bundled, offline, securityLevel
  strict), like plain diagram blocks.
- qty scaling: packets per edge = min(16, round(qty)); edge width =
  0.8 + log2(1+qty)*1.8, capped at 16 - so 9 vs 90 vehicles is
  visibly different.

## Example

`demo/examples/flow.md`: edge table + one `::: mermaid {#net}
flow=@roads` block animating traffic inside the diagram, plus a bar
chart of busiest origins.
