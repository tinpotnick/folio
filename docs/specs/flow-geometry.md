# Flow-figure geometry: real layouts for flow figures

## Status: accepted (2026-11-09) - implemented on vibe/flow-geometry

## Alternatives considered

**A. Nodes table only** (`nodes: @places` below). Explicit, fully
data-driven, but the author places every node by hand - painful for
larger graphs, and it duplicates nothing.

**B. Mermaid as the layout engine** (`diagram: @net` on the motion
block, referencing a `::: mermaid {#net}` block). The edge TABLE
stays the single source of truth for data (`from, to, qty, speed` -
frames are still ordinary table rows); the mermaid block provides only
STRUCTURE + POSITIONS (`graph LR` / `flowchart TD` / ... - block and
direction choice is the user's). The component renders the mermaid
SVG once, extracts node centres from its node groups, and rides the
packets along the table's edges between those centres. Validation:
every node/edge in the table must exist in the mermaid graph, else a
visible error (no silent drift between the two). Engine stays pure -
it stores only the `@net` reference; all mermaid work happens in the
component, like `drawDiagram` today (bundled, offline, strict).

**C. A `::: mermaid-motion` block whose body is mermaid text with
labeled edges** (`Market -->|9| Square`). One block, mermaid diagram
types (incl. sankey for pure flow maps), but edge data leaves the
table world and parsing mermaid's text syntax in the render layer is
brittle across diagram types.

**Recommendation: A + B together.** Layout is just "node id -> x,y",
so flow figures take an optional layout source with three modes:
circle (default) / `nodes: @places` (explicit map) / `diagram: @net`
(mermaid auto-layout). Data, frames, renditions and the inspector are
unchanged in all three - they all read `MotionData.nodes`. C is
rejected for now: it forks the data model; if sankey-style flow maps
are wanted later, that is a separate static rendition, not a motion
layout.

Risks of B, honestly: node positions are extracted from mermaid's
rendered SVG (node `<g id="flowchart-<id>-<n>">` groups with translate
transforms + rect sizes), which is mermaid-version-sensitive - pinned
via the existing `^12.2.0` dependency and unit-tested against a
fixture SVG; mermaid renders async, so the motion figure re-renders
when its diagram block changes (dependents, like charts); print
renditions (flowmap/trails/filmstrip) reuse the same extracted
positions, computed once per render.

## Context

Motion figures (spec: motion-figures.md, PR #140) include `type:
flow`: packets travel an edge list, played in the document and shown
as a static flow map in print. Today the node layout is a **circle**
by first appearance (`flowFromTable` in `src/render/motion.ts`):

```
                     @ Market
        Docks .        |        . Square
           ...         |         ...
             ...      |      ...
               ...    |    ...
                 ...  |  ...
                   ...|...
        Park @--------+--------@ Station   (all 5 on one circle,
                                            10 undirected edge lines,
                                            packets = chevrons per frame)
```

The packets themselves are fine - dumped from the live example, their
positions at frames 0 vs 24 advance along each edge by `speed` per
tick. What reads as "graph, not diagram" is the circle layout.

## Proposal

An optional `nodes: @places` key on the motion block: a table with
`id, x, y` columns gives the nodes real geometry. Without it, the
circle layout stays the fallback.

```
::: table {#places}
columns:
  - {name: id, type: text}
  - {name: x, type: number, align: right}
  - {name: y, type: number, align: right}
data:
  - [Market, 150, 90]
  - [Square, 330, 110]
  - [Station, 500, 100]
  - [Park, 200, 260]
  - [Docks, 470, 270]
:::

::: motion {#traffic}
type: flow
source: @roads
nodes: @places
:::
```

Same edge list, hand-placed towns - reads as a map:

```
@Market ............ @Square .............. @Station
   :                    .                      :: .
    :                  .                  :::   .
     :                .              :::        .
      :             .           :::             .
       :          .        :::                  .
        :       .     :::                       .
         :    .  :::                            .
          ::..::                               .
          @Park :::::::::::::::::::::::::::::::@Docks
```

## Rules

- Layout modes: circle (default), `nodes: @places` (this spec's
  table), `diagram: @net` (mermaid layout, alternatives B above).
  `nodes:` and `diagram:` are mutually exclusive - a visible parse
  error if both are set.
- `nodes:` is optional. An edge naming a node id that is not in the
  nodes table is a visible error; a node in the table with no edges
  is drawn, with no edges.
- Coordinates are in the figure's viewBox units (default 640x360).
  Unlike swarm (which normalizes data into the viewBox), flow does
  NOT auto-fit: the author places the map. Out-of-range coordinates
  are clipped by the viewBox. (Mermaid layouts live in mermaid's own
  coordinate space, so they are aspect-preservingly FITTED into the
  viewBox - that is unit conversion, not data auto-fit.)
- All renditions read the same `MotionData.nodes`: player, filmstrip,
  flowmap (print default), trails, poster, frame:N.
- The motion block's `id:`/`x:`/`y:` keys stay swarm column renames;
  the nodes table's columns are fixed `id, x, y` (the MOTION_KEYS
  allowlist gains only `nodes` and `diagram`; renames can come later
  if needed).
- The directive round-trips byte-identically like every other key.
- Examples: `demo/examples/flow.md` gains the `#places` table and
  `nodes: @places` on the traffic figure; a second example (or the
  same doc) shows `diagram: @net` with a `graph LR` mermaid block.
