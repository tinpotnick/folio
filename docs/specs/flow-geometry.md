# Flow-figure geometry: a nodes table for real map layouts

## Status: proposed (2026-11-09)

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

- `nodes:` is optional. An edge naming a node id that is not in the
  nodes table is a visible error; a node in the table with no edges
  is drawn, with no edges.
- Coordinates are in the figure's viewBox units (default 640x360).
  Unlike swarm (which normalizes data into the viewBox), flow does
  NOT auto-fit: the author places the map. Out-of-range coordinates
  are clipped by the viewBox.
- All renditions read the same `MotionData.nodes`: player, filmstrip,
  flowmap (print default), trails, poster, frame:N.
- The motion block's `id:`/`x:`/`y:` keys stay swarm column renames;
  the nodes table's columns are fixed `id, x, y` (the MOTION_KEYS
  allowlist stays closed; renames can come later if needed).
- The directive round-trips byte-identically like every other key.
- Example: `demo/examples/flow.md` gains the `#places` table and
  `nodes: @places` on the traffic figure.
