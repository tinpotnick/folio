---
name: drawn-show-first-contact
feature: Show a drawing, its code, or both (docs/specs/drawn-blocks.md, "Show")
steps:
  - Open the "Drawings from text" example (palette: "Open example: Drawings from text").
  - You are writing a tutorial: make the first Graphviz graph show its code under the drawing, permanently, so a reader sees both.
  - Make the Vega-Lite chart show only its code.
  - Print preview (or Export as PDF) and check what the paper shows.
expected:
  - Clicking a drawing reveals its header with a "Show" picker (drawing / code / both); Ctrl+K "show code" finds "Show code or drawing (or both)".
  - "both" keeps the drawing with its code under it after clicking away; "code" shows just the code.
  - The fences read ```` ```dot show=both ```` and ```` ```vega-lite show=code ````; choosing "drawing" again removes the key.
  - Paper shows each block as chosen: the graph with its code, the Vega-Lite code alone, the other drawings without code.
---
# First-contact eval: show a drawing's code

A user writing a tutorial wants readers to see the code behind a
drawing, on screen and on paper.
