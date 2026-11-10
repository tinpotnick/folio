# Motion figures: swarms and flows

## Status: accepted (2026-11-09)

## Decision

A motion figure is a **frame sequence rendered as static SVG frame
groups** (`<g class="mframe" data-i="k">`). The open document plays
the sequence in a loop on its own - no transport controls; clicking
the figure reveals its inspector bar (the one inspector contract:
reveal on click inside, hide on any click outside, Esc early, no
close button) with the source, renditions and caption. print/PDF
shows a designed static rendition
of the same frames. No SMIL, no script inside the SVG: the host swaps
group visibility, so the output stays sanitized and embeds in exports.

**Frames are ordinary table rows - the time axis is a COLUMN in long
format** (`frame, agent, x, y`), never a nested structure. Any column
can be the time axis (the block names it: `time: day`). The model,
queries, import, browser and golden round-trip are untouched; a
frames dataset also plots as ordinary charts (trajectory lines via
`series: agent`).

## Contract

- **Block**: `::: motion {#id}` with keys `type: swarm | flow`
  (required), `source: @table` (frames dataset for swarm; edge list
  for flow), `time:`, column renames (`id: x: y:` / `from: to: qty:
speed:`), built-in sim params (`seed: agents: frames: width:
height:`), `display:`, `print:`, `caption:`. Unknown keys are a
  parse error; the directive round-trips byte-identically.
- **Swarm** (`type: swarm`): agents as small velocity-oriented bird
  glyphs at their (x, y) per frame. No `source` → a built-in seeded
  MUMMURATION sim (`mulberry32`: each bird orbits a slowly wandering
  attractor with its own radius and angular speed; radial wobble makes
  the cloud breathe - the recognizable swallow swirl, and it never
  settles into a static blob): same seed, same flock, same PDF -
  deterministic and unit-tested. With `source: @frames` → plays any
  table with the frame/id/x/y columns (a Python compute block's
  published output included).
- **Flow** (`type: flow`): edge list `from, to, qty, speed`; nodes
  laid out on a circle by first appearance, or - with `diagram:
@net` - inside a mermaid diagram's own SVG (spec:
  flow-geometry.md). Per frame, up to 16 packets per edge (one per
  vehicle) travel each edge at `speed` (relative pace: an edge is
  crossed in 30/speed ticks, so movement is visible at the 15 fps
  player rate); edge width grows with `qty` (log scale). A `time`
  column gives real time steps instead of synthetic ticks.
- **Renditions** (the `display:` / `print:` vocabulary, so nothing is
  locked out - a new rendition is one renderer plus one enum value):
  `player` (default display; plays in the open document),
  `filmstrip` (frames as thumbnails; default print for swarm),
  `flowmap` (flow only; one static map, edge width ∝ total flow;
  default print for flow), `trails` (one line per agent through every
  frame, a dot at each intermediate location, a distinct marker at the
  final one - movement in a still), `poster` (frame 0), `frame:N`.
  `print: player` maps to `filmstrip` (a still PDF cannot play).
  Unknown values are the figure's visible error text, and so is
  `flowmap` on a swarm (a swarm has no edges - an error, never a
  blank figure; the inspector bar does not offer it there). Screen shows
  the `display:` rendition, print the `print:` one, via CSS on
  `figure[data-display]` / `[data-print]` - so browser print,
  desktop PrintToPdf and preview all agree.

- **Inspector bar** (the one inspector contract): clicking the
  figure reveals a bar with **Data** (source dataset, or "(built-in
  simulation)" for swarm), **Display** and **Print** rendition
  selects, and the caption - model writes that re-render the figure
  in place and keep the bar open across the re-render.
- **Dependents**: editing a source table redraws its motion figures
  in place (`refreshDependents`), like charts.
- **Insert**: **+ Insert › Swarm figure / Flow figure** and palette
  "Insert a swarm/flow figure (animated)". Swarm needs no data;
  flow needs an edge-list dataset at the caret.
- **Compute budget** (Q2): a compute block's fence info takes
  `budget=N` (seconds) - a finite per-block run limit replacing the
  10 s default for that block, hard-capped at 120 s so a stuck job
  still fails alone. Sims should run once and publish a frames table;
  nothing runs per tick.
- **Figure numbering**: motion figures count as figures ("Figure N")
  in cross-references.

## Acceptance

- Unit: `tests/render/motion.test.ts` (seeded determinism, frames
  from a table column, unknown-column error, player/filmstrip/
  flowmap SVG shapes, rendition parsing/defaults, directive
  round-trip, unknown-key parse errors);
  `tests/compute/evaluate.test.ts` (budget parse/format).
- e2e: `tests/e2e/motion.spec.ts` (flow plays/stops/prints as the
  flow map; swarm plays a dataset; table edit redraws a flow figure;
  palette insert; unknown rendition is a visible error);
  `tests/e2e/examples-smoke.spec.ts` covers the two examples.
- Examples: `demo/examples/swarm.md` (a Python compute block
  publishing `@frames`, played by the figure, plus a trajectory
  chart), `demo/examples/flow.md`.
- Help: `demo/help/motion.md`. Eval: `evals/motion-figures-first-contact.md`.
