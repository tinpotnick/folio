# Motion figures: swarms and flows

A **motion figure** is a frame sequence: the document stores the
frames as ordinary table rows (the time axis is just a column -
`frame, agent, x, y`), and the open document plays the sequence in a
loop - no transport controls. Click the figure to reveal its
inspector bar (the standard reveal/hide/Esc contract) with the
**source**, **display** and **print** renditions and the caption.
Print and PDF show a static rendition of the same frames instead.

- **Swarm** (`type: swarm`): a flock of agents, each a small arrow
  at its (x, y) per frame. With no `source`, a built-in seeded
  simulation runs (`seed`, `agents`, `frames`, `width`, `height` -
  the same seed always gives the same flock). With `source: @frames`,
  the figure plays any dataset whose columns are the frame, the
  agent id, and x/y (`time:`, `id:`, `x:`, `y:` rename them) - for
  example a table a Python compute block published.
- **Flow** (`type: flow`): an edge list (`from`, `to`, `qty`,
  `speed` - rename with `from:`/`to:`/`qty:`/`speed:`) drawn as a
  graph; per frame, `qty` packets travel each edge at `speed`. A
  `time` column gives real time steps instead of synthetic ticks.
  Node layout (spec: flow-geometry): `nodes: @places` takes positions
  from a table with `id, x, y` columns (viewBox units - place the
  map yourself); `diagram: @net` takes them from a `::: mermaid`
  block's rendered nodes (mermaid is only the layout engine - the
  edge table still owns the data); with neither, nodes sit on a
  circle. `nodes:` and `diagram:` are mutually exclusive.
- **Renditions**: `display:` picks what the open document shows
  (`player` - the default, `filmstrip`, `flowmap` for flow, `trails`,
  `poster`, `frame:N`); `print:` picks the PDF rendition (same words;
  defaults: swarm `filmstrip`, flow `flowmap`; `player` in print means
  the filmstrip, since a still PDF cannot play). A filmstrip prints
  the frames as thumbnails; a flowmap prints one static map with edge
  widths proportional to total flow; `trails` prints each agent's path
  through the frames - a line, a dot at each intermediate location and
  a bold marker at its final one.
- Insert them from **+ Insert › Swarm figure / Flow figure**, or
  Ctrl+K "insert a swarm/flow figure". A flow figure needs an
  edge-list dataset at the caret.
- Frames are data: a line chart over `@frames` (`select: [frame,
  x]`, `series: agent`) plots trajectories, and editing the table
  re-runs the figure - no run button anywhere.
