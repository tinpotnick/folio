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
- **Rows shown, per table** (2026-10-29): a dataset may set its own
  window with `show: 12` (a whole number of rows) or `show: all`,
  written after the provenance keys and before `columns:`; absent,
  the document's `table.rows.show` applies. The table bar's **Rows**
  picker writes it - "default (50)", 5, 10, 25, 50, 100, "all", plus
  the table's own number if it is another - and the palette's
  "Choose how many rows a table shows" opens that picker for the
  table at the caret. It is a content choice, like a chart's query -
  how much of the data the page quotes - not styling (ADR-0002): the
  data is never cut, and charts, formulas and the browser still see
  every row. A bad value is a parse error naming the table. Simple
  (pipe) tables keep the document's window.
- **Browser (full-screen spreadsheet surface)**: opened from the
  status line or the table inspector's grid button. It is NOT a
  modal and not a page: no backdrop, no card edge, no desk - it
  owns the whole viewport, full-bleed, on the document's paper
  (`--folio-paper`; chrome rows sit on `--folio-surface`). It
  dresses as a spreadsheet: a toolbar row (dataset `@id` and the
  section it lives in, the Jexl filter box, the row count, and an
  icon-only ✕ close at the far right - window chrome, not a web
  "back" link), a formula bar below it, then the grid with a
  row-number gutter. Closed with ✕ or Esc, which scrolls the
  document back to the table's figure. Inside the grid:
  continuous virtualized scrolling (only the visible window of
  rows is in the DOM), a Jexl filter box using the charts' exact
  filter language (`v > 115`, `region != "South"` - unknown
  columns are a visible error), click-header sorting that cycles
  asc → desc → unsorted (a VIEW sort - it never writes the
  model's sort), and click-to-edit cells. The surface never
  prints (hidden in `@media print`).
- **Selection and the formula bar**: clicking any cell selects it
  (accent ring); clicking an editable cell also opens its editor,
  while a computed cell is read-only and selecting one shows its
  FORMULA in the formula bar (`ƒx` row: cell ref like `d12`, then
  the column's `expr`); an editable cell shows its raw value.
  Arrow keys move the selection (kept in view), Enter opens the
  editor on the selected editable cell, Escape closes the browser
  (or reverts an open editor). On a sheet wider than the window
  the header row and every row carry a min-width of the grid's
  minimum track width, so the header's background paints across
  the whole scroll width (no transparent heading cells when
  scrolled right), and the row-number gutter is sticky-left.
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
- The sheet lives in the component's shadow root (sibling of
  the article), so the article's structural sync never sees it;
  a document reload closes it (without the return-to-figure
  scroll - only the button and Esc return).

## Acceptance

- Engine: `tests/engine/query.test.ts` (filterIndexes/sortIndexes
  model-order indexes, unknown-column error, view sort leaves the
  model untouched, filter+sort composition regression).
- e2e: `tests/e2e/dataset.spec.ts` (12 tests: window + status
  line, chart over a windowed table still plots every row,
  style key override, small tables unchanged, virtualized
  scrolling to the last row, Jexl filter with typo error, view
  sort asc/desc/unsorted cycle, row numbers + formula bar +
  arrow-key selection, cell edit rippling to figure/formulas/
  source, inspector button, Esc/✕ returning to the table's
  figure, wide sheet scrolled right keeps the header painted
  and the gutter stuck); `tests/e2e/table-rows-shown.spec.ts`
  (the Rows picker, `show:` in the source, all, back to default,
  the palette entry). Engine: `tests/engine/table-show.test.ts`.
- First-contact eval: `evals/dataset-browser-first-contact.md`.
- Documented in `demo/help/tables.md`.
