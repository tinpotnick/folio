---
name: drawn-blocks-first-contact
feature: drawn code blocks (docs/specs/drawn-blocks.md)
steps:
  - From the welcome page, open "Drawings from text".
  - Add a node to the first graph.
  - Insert your own Graphviz diagram in a document without reading
    docs, then break it on purpose.
expected:
  - The graphs render as themed figures in light and dark mode; no
    code shows until a figure is clicked.
  - Clicking reveals the DOT source; editing it redraws the graph.
  - Searching the palette for "graph", "graphviz" or "diagram" finds
    Insert a Graphviz diagram; a broken graph shows "Diagram error:
    ..." in place of the picture.
---
