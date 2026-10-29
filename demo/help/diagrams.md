# Diagrams and drawings

- Diagrams are Mermaid blocks: `::: mermaid {#id}` ... `:::` with
  the diagram source in between. They render as figures; edit the
  source in the Markdown view and switch back to re-render. Click a
  diagram to select it (it gets an outline) and press Backspace or
  Delete to remove it. Clicking a diagram, chart, or equation also
  opens its **inspector bar** - the Mermaid source, the chart's
  source/type/filter/sort/caption, or the LaTeX - editable in
  place, so you rarely need to drop to the Markdown view.
- Some code blocks draw a picture instead of showing code. The
  drawing is the figure; click it to see and edit its source (it
  redraws as you type).
- **Graphviz**: a block tagged `dot` draws a graph laid out by
  [Graphviz](https://graphviz.org). List the nodes and edges
  (`a -> b`); Graphviz places them. Search "graphviz" in the palette
  to insert one. The theme sets its fonts and colours unless the
  graph sets its own.
- **Vega-Lite**: a block tagged `vega-lite` holds a
  [Vega-Lite](https://vega.github.io/vega-lite/) chart spec (JSON) for
  heatmaps, layered charts and small multiples. Write
  `"data": {"name": "@my-dataset"}` to chart a folio dataset; the chart
  follows the table as you edit it. Data from URLs is not allowed:
  documents work offline. Search "vega" in the palette to insert one.
- **SVG**: a block tagged `svg` is a hand-written drawing, shown as
  it is. Use `currentColor` (the page's ink) or the theme's colours,
  such as `var(--folio-accent)`, and it follows the theme and dark
  mode. Scripts and anything loaded from the internet are removed.
  Search "svg" in the palette to insert one.
- **Sheet music**: a block tagged `abc` is a tune in
  [ABC notation](https://abcnotation.com), engraved as a score. Click
  it and press **Play** to hear it, through folio's own simple
  synthesizer (nothing is downloaded). Search "sheet music" in the
  palette to insert one.
- The *Drawings from text* example shows each kind.
