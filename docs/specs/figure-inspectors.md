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
  differently for no user-visible gain. "Outside" means anywhere
  that is not inside the figure: the rest of the page, AND the desk
  around the page and the host's own UI. A document-level listener
  catches presses that never reach the component's shadow tree
  (e2e: "a click on the desk outside the page hides the
  inspector"). Any NEW inspector must
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

## Bars wear the toolbar's clothes (2026-11-05)

An inspector bar is a chip in the main toolbar's visual language
(docs/specs/toolbar.md): a 1px rule-strong border, 8px radius, one
28px control height, 6px-radius bordered controls on the input
background, hover fills, focus rings - instead of the earlier loose
form row. No `font:` shorthand on the shared control rule: it would
reset `font-style` and outrank the unit field's italic.

- **The chart bar's Type is a segmented icon control**
  (`.insp-seg`, one 16px icon button per type, `aria-pressed` on the
  current one, ringed in the accent when active), not a `<select>`.
  The other fields stay labelled text/select controls.
- The table bar's selects, inputs and buttons get the same 28px
  height and chip shape; the checkbox keeps its native size with the
  accent as its check color.
- The dismissal contract above is unchanged: reveal on a click
  inside the figure, hide on any click outside it, Esc dismisses
  early, no close button.

## Acceptance

- e2e: `tests/e2e/figures.spec.ts` (equation insert via button and
  palette, H3 convert/reflection/settings, header-click bar with
  italic unit, chart flip to line via the type icons + filter edit
  reaching source, math and Mermaid in-place edits).
- First-contact eval: `evals/figure-inspectors-first-contact.md`.

## Revealing a bar never moves the figure (2026-10-21)

A bar appears ABOVE its figure, in flow, so revealing it pushed the
figure down by its height (a table jumped ~50px under the pointer).
The component now scrolls by that height as the bar appears, so what
was clicked stays put. Bars are NOT floated over the text above,
because that hid the paragraph people click to leave the figure.
Hiding is not compensated: the click went elsewhere, and that spot
must not move.

**Labelled fields**: the chart bar labels every field (Data, Type,
Columns, Filter, Sort by, Order, Caption), each label naming its
control, and wraps onto a second row instead of truncating.
Placeholders vanish once a field is filled. The chart's Data picker
lists only datasets: simple tables cannot feed charts.

A click on a figure (outside its code, cells or headers) lights no
toolbar block or format button until the next keystroke or text
click. Before, the engine left the selection at the document's start,
and a chart caption click lit H1.

e2e: `tests/e2e/backlog-polish.spec.ts`.
