# Dataset browser and the table viewport

## Status: accepted (2026-10-18)

## Decision

A table of any size has exactly one home: the document model.
The in-flow figure shows a compact VIEW of it; the dataset
browser is the dedicated surface for full-scale work. Neither
view is a source of truth - both are model projections, and
charts/formulas/queries always see every row regardless of what
any view displays. This is the "document cites, dataset
explores" split: an inline spreadsheet would fight the page
flow (nested scroll, a grid engine in a paragraph), and pager
chrome would put a widget inside a document.

## Contract

- **Viewport (in flow)**: a table longer than the theme's window
  renders its head rows plus a status line - "120 rows x 3
  columns - showing first 50" - with an "Open dataset" button.
  The window is the `table.rows.show` style key (default 50,
  minimum 3; a table at or under the window renders exactly as
  before). Print/PDF shows the same compact view: the paper
  artifact cites the dataset with its row count.
- **Browser (overlay)**: opened from the status line or the
  table inspector's grid button; closed with Esc or Done. It
  owns the viewport: continuous virtualized scrolling (only
  the visible window of rows is in the DOM), a Jexl filter box
  using the charts' exact filter language (`v > 115`,
  `region != "South"` - unknown columns are a visible error),
  click-to-toggle header sorting (a VIEW sort - it never
  writes the model's sort), and click-to-edit cells.
- **Editing**: cell commits are model writes - the value lands
  in `block.table.rows`, the in-flow figure's rendered cell and
  formula cells refresh, charts redraw, and the Markdown source
  carries the edit. Enter commits, Escape reverts, Tab commits
  and moves to the next editable cell. Formula columns are
  read-only (computed, muted); percent formats render as in
  flow.
- **Engine primitives**: `filterIndexes(table, expr)` and
  `sortIndexes(table, by, order)` (src/engine/query.ts) return
  MODEL row indexes so the browser can map displayed rows back
  to their model positions. `executeQuery` runs the same index
  pipeline - filter and sort compose (sorting never resurrects
  filtered-out rows; that bug shipped once and has a regression
  test).

## Performance notes

- DOM cost is O(window), not O(rows): a 2,000-row import
  renders 50 rows in flow; the browser renders ~25.
- `recalcTable`/`filterIndexes`/`sortIndexes` are linear in
  rows - 2,000-row evaluation is instant; the textarea source
  view is the real ceiling for very large datasets (a multi-MB
  Markdown source needs its own virtualization, tracked in
  docs/specs/section-windowing.md).
- The overlay lives in the component's shadow root (sibling of
  the article), so the article's structural sync never sees it;
  a document reload closes it.

## Acceptance

- Engine: `tests/engine/query.test.ts` (filterIndexes/sortIndexes
  model-order indexes, unknown-column error, view sort leaves the
  model untouched, filter+sort composition regression).
- e2e: `tests/e2e/dataset.spec.ts` (9 tests: window + status
  line, chart over a windowed table still plots every row,
  style key override, small tables unchanged, virtualized
  scrolling to the last row, Jexl filter with typo error, view
  sort both directions, cell edit rippling to figure/formulas/
  source, inspector button, Esc/Done).
- First-contact eval: `evals/dataset-browser-first-contact.md`.
- Documented in `demo/help.md`.
