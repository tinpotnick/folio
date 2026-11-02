# Section windowing for large documents

## Status: proposed (2026-10-18) - analysis, no implementation yet

## Problem

Every render is O(document): a full render() rebuilds every
block, and charts redraw, Mermaid and KaTeX re-import-and-draw
async, on EVERY view switch and every settings apply. Typing is
fine (structural sync is O(blocks) per keystroke and no re-render
runs), but opening or switching views on a large document costs
proportionally, and generated figures dominate.

## Options considered

1. **Windowed rendering by H1 section** (the proposal on the
   table): render only the current section; scroll near the
   boundary loads the next section; the section browser jumps
   render the target section.
   - Fatal complication today: the DOM is the source of truth
     during typing (syncFromDom rebuilds the model from the
     article's children). Windowing removes non-rendered blocks
     from the DOM, so structural sync would silently DELETE every
     unrendered block. It requires an editing model that can
     round-trip through a partial DOM - a redesign of the
     structural sync, caret handling across section boundaries,
     undo, and the round-trip invariants. High risk, needs its
     own ADR and a staged prototype.
2. **Defer generated figures until visible** (IntersectionObserver
   on figures; draw chart/diagram/math lazily, mark drawn, don't
   redraw on re-render unless data changed): cheap, zero model
   risk, attacks the dominant cost (Mermaid/KaTeX/redraws), keeps
   the document a single continuous flow (no "page flips" to get
   wrong).
3. **Do nothing until a real document is slow**: render cost is
   linear and unmeasured; the current sample renders instantly.

## Update (2026-10-18)

Table scale is no longer a render problem: the table viewport
and the dataset browser (docs/specs/dataset-browser.md) cap the
in-flow DOM cost at the window regardless of row count. This
spec's remaining subject is TEXT-scale documents (many sections
and figures), unchanged below.

## Recommendation

Do Stage 2 (lazy figures) first - it is small, safe, and
addresses the actual hot path. Do NOT attempt section windowing
until a real document measurably needs it; if that day comes,
the sync redesign is the precondition, not the windowing itself.
This spec records the analysis so the decision is not relitigated.

## Update (2026-10-30): Stage 2 implemented

Generated figures (charts, Mermaid diagrams, KaTeX math, drawn/JSCAD
models) are now drawn lazily: renderBlock marks the figure
`data-pending` and an IntersectionObserver (800px root margin) draws
it when it nears the viewport (src/component.ts `lazyFigure`). The
DOM is untouched - only the draw is deferred, so the
DOM-is-source-of-truth editing model is unaffected. Mode changes
re-dress only figures already drawn; pending ones stay pending.
Print/export never shows a blank figure: `preparePrint` and both
print paths call `drawAllFigures()` (printDocument/exportPdf await
it), which draws every pending figure and settles `drawn()`.
Reaching for a waiting figure draws it at once, not only scrolling
near it (2026-11-01): pointing at it, pressing it, or focusing into it
(`drawPending`, the one path the observer and `drawAllFigures` use
too). A readable chart (line, bar, area) is focusable and marked
`data-readable` from the start, so Tab and the palette's "Read a
chart's values" reach it before it has drawn; focused while drawing,
it shows its readout as soon as it is drawn. A waiting chart keeps the
space it will take (`aspect-ratio: 640 / 300`, the frame every chart
draws in), so drawing never pushes the page down under the reader. A
drawn block (JSCAD included) draws through `drawDrawn` - the lazy
path once called `paintJscad`, which only repaints a built model, and
no model drew.
Tests check a figure the way a reader does: they scroll to it first
(tests/e2e/reader.ts: `readThrough`, `scrollToFigure`).
e2e: tests/e2e/lazy-figures.spec.ts (pending below the fold, drawn
on scroll, drawn by drawAllFigures and by beforeprint; reserved
space; drawn on focus with the readout; a lazy 3D model).
