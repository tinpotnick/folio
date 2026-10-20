# Figure inspectors: charts, equations, diagrams, images

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
  (`@id` options), type (bar / line / area / pie / donut /
  scatter), selected columns (comma text), Jexl filter (empty
  removes), sort by + order (empty by removes the sort), caption
  (empty removes). Apply redraws the chart in place and syncs
  the source; chart errors (bad filter column, unknown sort,
  non-negative-only data in a pie) surface as the chart's
  visible error text - the error contract, not a broken render.
- **Image inspector** (click the image, spec: docs/specs/
  images.md): alt text, caption, and a replace-file control -
  edits are model writes like everywhere else.
- **Code header** (spec: docs/specs/code-blocks.md): every fenced
  code block's inspector - the language picker, plus per-language
  controls (Strudel's player). The body edits in place, so the bar
  carries no source textarea.
- **Math / diagram inspectors** (click the figure): a textarea
  with the block's source (LaTeX / Mermaid); Enter or blur applies
  (Shift+Enter for a newline), redrawing the figure in place.
- **Shared bar mechanics**: contenteditable="false" so inputs own
  keystrokes; `figure[data-chart-source]` follows the edited
  source so charts of the same table stay addressable.
- **Dismissal is uniform - the table inspector's contract, not a
  special case**: every bar (table, chart, math, diagram, code) reveals
  on a click inside its figure and hides on any click outside
  it; Esc inside a bar dismisses early. There is no close
  button: the earlier × was an inconsistent second dismissal
  path, and the brief "figure bars persist across outside
  clicks" experiment made the two bar families behave
  differently for no user-visible gain. Any NEW inspector must
  follow this same rule - it is checked in review
  (see AGENTS.md Working rules).

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
