---
name: compute-first-contact
feature: Compute blocks (docs/specs/compute-blocks.md, ADR-0030)
steps:
  - From the welcome page, open the "Coffee forecast" example.
  - Change a day's takings in the sales table and watch the Python's
    trend line, band and both charts follow.
  - Click a computed table to see the code that produced it; change
    the band's width (the 40s) and watch the band follow.
  - Add a compute block to any document with a dataset, without
    reading docs.
expected:
  - The compute outputs render as themed tables, never as console
    text; the chart over @forecast draws. No run button anywhere.
  - Editing a bound dataset recalculates the output (and any chart
    over it) with no further action.
  - The code shows on a click inside the figure and hides on a
    click outside; editing it recalculates a moment after typing
    pauses; errors name what is wrong, as the figure's text.
  - Searching the palette for "python", "compute" or "script"
    finds Insert a compute block (Python); the inserted starter
    binds the document's dataset and computes.
---
