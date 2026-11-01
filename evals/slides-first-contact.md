---
name: slides-first-contact
feature: slideshow
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review").
  - Press Ctrl+K, type "play", and press Enter. The document renders fullscreen as slides, one per H2 (the H1 title and preamble hide), with a "Slide n of N" counter.
  - Advance with Arrow Right twice, then go back once with Arrow Left.
  - Press Esc (or click the play button) to stop.
  - Play again, then print (Ctrl+P): the printout paginates one 16:9 slide per page.
  - Stop the slideshow and print again: continuous A4 paper as before.
  - Save the document and confirm the saved file has no slide markup - it is byte-identical to before playing.
expected:
  - Play is findable from the toolbar play button or the palette with no instructions.
  - Each H1 starts a slide; H2s never split; the counter reads "Slide n of N" and advancing past the last slide stays on it.
  - Esc exits fullscreen and slide rendering together.
  - While playing, print/export uses 16:9 pages with one slide per page and no page furniture; with play off, A4 continuous.
  - The document on disk is unchanged by presenting.
---
