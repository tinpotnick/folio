---
name: motion-figures-first-contact
feature: motion-figures
steps:
  - Open the demo host on the swarm example (palette: "Open example:
    A murmuration, simulated").
  - Open the swarm example's figure (frames from the Python block);
    watch it loop with no transport controls.
  - Click the figure: its inspector bar shows Data, Display, Print
    and Caption; switch Display to filmstrip and back.
  - Open the flow example ("Traffic on a small road network") and
    watch the flow loop.
  - Print-preview (or export PDF) each example: the swarm shows a
    filmstrip of frames, the flow shows a static flow map.
  - With the caret in a paragraph, Ctrl+K "insert a swarm figure".
expected:
  - Motion figures render as frame sequences and play in a loop on
    their own (no Play/Stop); clicking one reveals its inspector bar
    with Data/Display/Print/Caption (the standard reveal/hide/Esc
    contract); clicking away hides the bar.
  - The built-in flock is deterministic (reload and it is the same
    flock); the Python-published @frames figure plays 8 frames x 4
    birds, and the same table plots as a trajectory line chart.
  - In print, the swarm figure shows its frames as a filmstrip and
    the flow figure shows one static map with edge widths
    proportional to flow; no player chrome prints.
  - The palette inserts a swarm figure at the caret and the source
    shows the `::: motion` block with `type: swarm`.
  - An unknown display/print value shows as the figure's error text,
    not a broken render.
---
