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

## Recommendation

Do Stage 2 (lazy figures) first - it is small, safe, and
addresses the actual hot path. Do NOT attempt section windowing
until a real document measurably needs it; if that day comes,
the sync redesign is the precondition, not the windowing itself.
This spec records the analysis so the decision is not relitigated.
