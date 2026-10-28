# Chart readout

## Status: accepted (2026-10-28)

## Decision

A chart can be READ precisely: point at it, tap it, or focus it and
use the arrow keys, and a guide marks the nearest x with each series'
value there. It is a reading aid, in the spirit of folio's citation
and cross-reference tooltips - not an interaction with the data: it
changes nothing, and it never carries meaning the static chart lacks
(a chart is complete on paper: its axes carry the scale, and a sparse
or single-series chart labels its values). No zoom, pan, brushing or
series toggling - those make a document a dashboard.

## Contract

- **Which charts**: line, area and bar charts, one series or several
  (stacked or not). Each renderer returns its `readout` (`src/render/
  chart.ts`): per x its label and position, per series its values and
  where they are drawn, in the chart's own units. Scatter points and pie
  slices carry the browser's own tooltip instead (an SVG `<title>`:
  "x, y" / "label: value (n%)"), having no single x to read across.
- **What shows**: a dashed guide at the nearest x (on a bar chart, a
  soft band behind the category), a dot on each series there (on
  grouped bars, on each series' own bar), and a panel beside the guide
  (on whichever side has room, never outside the chart) with the x
  label - an ISO date reads "31 Oct 2001", a month "Jan 2024" - and
  each series' name and value in its column's terms: its format and
  its unit ("£1,389.58", "4.13%", "25 years"), plain numbers at most
  two decimal places; a blank reads "-". In a chart narrower than
  520 px the panel is compact and sits in the top corner away from the
  point read, so it does not cover it.
- **How**: pointer move (mouse, pen) shows it and leaving hides it; a
  tap shows it (touch has no hover) and a tap elsewhere hides it; the
  chart is focusable (Tab), focus shows the latest x, Left/Right step,
  PageUp/PageDown move 12 points (a year of monthly data), Home/End
  jump, Esc puts it away (and is left to the document when no readout
  shows). Pointer-out hides it unless the chart itself has focus. The panel's text is announced to
  screen readers (`aria-live`).
- **Discoverable**: the palette's "Read a chart's values" focuses the
  chart most in view.
- **No clash**: a click still opens the chart's inspector (the
  figure-inspectors contract); the readout listens, it never captures.
  On touch, a tap therefore shows the readout AND the inspector bar.
- **Nothing in the document, nothing on paper**: the source is
  unchanged and print hides the readout.

## Acceptance

- e2e: `tests/e2e/chart-readout.spec.ts` (pointer, keys, Esc, touch, a
  click still opens the inspector, print hides it, single-series charts).
- WebKitGTK: `tests/webkitgtk/chart-readout-native.js` (a pointer over a
  line chart reads the month in money format; real Left keys step).
- First-contact eval: `evals/chart-readout-first-contact.md`.
