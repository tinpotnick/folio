# Figure inspectors: charts, equations, diagrams

## Status: accepted (2026-10-18)

## Decision

Generated figures are editable from the document view. Clicking a
chart, equation, or diagram figure reveals an inspector bar above
it (the table inspector's pattern, extended): edits are model
writes that re-render the figure in place and reach the Markdown
source exactly like hand-editing the directive. No dropping to
the source to change a filter or fix a Mermaid typo.

## Contract

- **Insert equation**: the insert group gains an equation button
  (SVG ƒx-style icon) beside table/diagram/code; `insertMath()`
  appends a `$$` block after the caret's block (`E = mc^2`
  starter). The palette command ("Insert an equation") works
  WITHOUT prior document focus - it appends at the document end
  (button mousedown requires an editable, the palette must not).
- **Chart inspector** (click the chart): source table select
  (`@id` options), type (bar / line - line renders as a polyline
  with markers over the same negative-capable axis), selected
  columns (comma text), Jexl filter (empty removes), sort by +
  order (empty by removes the sort), caption (empty removes).
  Apply redraws the chart in place and syncs the source; chart
  errors (bad filter column, unknown sort) surface as the chart's
  visible error text - the error contract, not a broken render.
- **Math / diagram inspectors** (click the figure): a textarea
  with the block's source (LaTeX / Mermaid); Enter or blur applies
  (Shift+Enter for a newline), redrawing the figure in place.
- **Shared bar mechanics**: contenteditable="false" so inputs own
  keystrokes; `figure[data-chart-source]` follows the edited
  source so charts of the same table stay addressable.
- **Persistence (the difference from the table inspector)**:
  figure bars are EDITING SURFACES, not click context. Clicking
  anywhere outside the figure leaves them open with their
  unapplied input intact; they close on the × button, Esc inside
  the bar, or when ANOTHER figure is clicked (one bar at a
  time). The table inspector keeps its context semantics: it
  follows the click (any cell click re-targets it; leaving the
  table closes it).

## Also in this change

- **H3**: the block bar gains H3 (`setBlockKind` handles h1-h3;
  reflection follows automatically), and `h3.font.size` joins the
  document settings (theme default 16pt).
- **Table inspector refinements**: clicking a column HEADER opens
  that column in the bar (the heading itself is never edited in
  place; the unit is a separate, italic field there, and the
  header's unit span renders italic too).

## Acceptance

- e2e: `tests/e2e/figures.spec.ts` (equation insert via button and
  palette, H3 convert/reflection/settings, header-click bar with
  italic unit, chart flip to line + filter edit reaching source,
  math and Mermaid in-place edits).
- First-contact eval: `evals/figure-inspectors-first-contact.md`.
