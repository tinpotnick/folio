# Flow-figure geometry: the diagram is the layout

## Status: accepted (2026-11-10) - implemented on vibe/flow-in-diagram

## Decision

Node locations live in the **diagram**, not in a table. A flow figure
with `diagram: @net` references a `::: mermaid {#net}` block: mermaid
lays the nodes out (block and direction are the author's choice -
`graph LR`, `flowchart TD`, ...), and the motion figure animates
**inside the mermaid diagram's own SVG** - the rendered diagram is the
player base and the packet frames are injected into it, in the
diagram's coordinate space. Without `diagram:`, nodes sit on a
circle (deterministic fallback, own SVG).

```
::: mermaid {#net}
graph LR
  Market --> Square
  ...
:::

::: motion {#traffic}
type: flow
source: @roads
diagram: @net
:::
```

The edge table remains the single source of truth for DATA
(`from, to, qty, speed` - frames are still ordinary table rows).
Mermaid provides structure + positions only. Every edge/node in the
table must exist in the diagram, else a visible error.

## Rules

- `diagram:` is optional and the only layout key (an earlier
  `nodes: @table` key was removed - locations in a table were
  rejected in review).
- Mermaid renders async: the figure first shows "Laying out from
  @net…", then redraws in place once the layout lands. Layouts are
  cached per diagram id and invalidated when the diagram text changes
  (the cache is keyed to the text; cleared on document load). Editing
  the diagram or the edge table redraws the figure in place.
- The mermaid SVG's viewBox becomes the figure's width/height, so the
  player, filmstrip, poster/frame and trails all share the diagram's
  coordinate space. The flowmap (print default) is the designed
  analytical overlay: our own SVG at the same dimensions.
- Player base: the diagram's own edges are hidden and redrawn with
  qty-weighted widths (log scale, capped at 16), so quantity reads in
  the animated diagram; packets (up to 16 per edge, one per vehicle)
  move on top. Filmstrip thumbs and poster/frame embed the base with
  one frame group; trails draw packet paths over the base.
- Node ids in the mermaid text must be simple (letters/digits/dash/
  underscore) and match the edge table's from/to values - mermaid
  rewrites anything else. Positions are extracted from the rendered
  SVG's node groups (`<renderId>-flowchart-<id>-<n>`, rect centred on
  the translate); pinned via the `^12.2.0` dependency and fixture unit
  tests. A diagram with no flowchart nodes is a visible error.
- Engine stays pure: it stores only the `@net` reference. Mermaid runs
  in the component (bundled, offline, securityLevel strict), like
  diagram blocks. The directive round-trips byte-identically.
- qty scaling: packets per edge = min(16, round(qty)); edge width =
  0.8 + log2(1+qty)*1.8, capped at 16 (player overlay) and proportional
  share of total in the flowmap. So 9 vs 90 vehicles is visibly
  different.

## Example

`demo/examples/flow.md`: edge table + `::: mermaid {#net}` + one
motion figure with `diagram: @net` animating inside the diagram, plus
a bar chart of busiest origins.
