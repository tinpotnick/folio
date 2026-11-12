# Table inspector (formula bar)

## Status: accepted (2026-10-18)

## Decision

An Excel-style inspector bar at the top of every table figure:
clicking a cell reveals the clicked column's properties - and
for formula columns, the ƒx expression Excel users look for. The
bar is the document-view editing surface for column metadata
(type, unit, format, expression), so tables are fully editable
without dropping to the Markdown source. Units are also rendered
in column headers ("q2 (£k)") - they were parsed into the model
from the start but never displayed, dead metadata no one could
see.

## Contract

- **Reveal**: any cell click (editable or read-only - formula
  cells especially) shows the bar with that column selected;
  clicking outside the table hides it. The bar is
  contenteditable="false" inside the article: its inputs own
  their keystrokes, and keydown/input events from it never reach
  the article's structural handlers.
- **Controls**: column select (switch inspected column), **visible**
  checkbox (2026-11-04), type select (text / number / formula), unit
  (shown in the header as "(unit)"), format (plain / percent), and
  for formula columns the ƒx expression input (Enter or blur
  applies). Unticking **visible** sets `hidden: true` on the column:
  it is not drawn in the table figure, but stays in the document's
  data - formulas, charts, filters and the dataset browser all still
  see it (wide imports hide their noise: a CDR's uuid). The column
  select marks hidden columns "(hidden)". Simple (pipe) tables have
  no hidden columns - their source is kept verbatim.
- **Palette**: "Show or hide columns of the table at the caret"
  (`focusTableColumns`) opens the bar and focuses the checkbox.
- **Context menu** (2026-11-04, the fast path): right-clicking any
  cell or column header of a dataset adds "Hide column '<name>'";
  while any column is hidden, the menu offers each hidden column back
  ("Show column '<name>'", individually up to five, else one "Show
  all N hidden columns") - one click per column, no inspector
  round-trip, one re-render per action (`setColumnsHidden`).
- **Edits are model writes**: the patch writes
  `block.table.columns[c]`, refreshes the table figure in place,
  re-shows the bar, and emits change - identical to editing the
  YAML by hand, so the source always reflects the bar. Removing
  a value (empty unit, plain format) removes the key.
- **Safety**: switching a column's type to formula with no
  expression seeds `expr: "0"` - an empty expression breaks
  recalc; emptying the ƒx input falls back to "0".
- **Units in headers**: `th` renders "name (unit)" — the unit in a
  muted, italic span (metadata, visually distinct from the
  name); the sample document's "£k" is finally visible. The rule
  is a base style: it applies to every table style, not only
  `table.style: plain` (it lived inside the plain-only branch
  before, so the default booktabs style rendered the unit
  roman — the bug behind "unit is not italic in the desktop
  app").
- **In-place header rename**: the header's NAME is a nested
  editable span (`th .name`, contenteditable, focused on click
  like a data cell); the unit stays read-only. While the name is
  edited the th is all name: the unit hides and the span fills
  the cell (`.editing`), so renaming feels like editing any
  other cell - and any click in the th except on the unit starts
  the rename. It is the
  document-view counterpart of editing the column name in the
  YAML: commit on Enter/Tab/blur writes
  `columns[c].name`, updates the inspector's column dropdown,
  and emits change; Escape reverts; an emptied name reverts (a
  column always keeps a name). Enter then drops the caret into
  the column's first editable cell; Tab moves to the next
  header (past the last, into the first editable cell); Ctrl+A
  selects the name, never the document. Charts that select or
  sort by the old name follow the rename (exact-match on
  `query.select` entries and `query.sort.by`); formula
  expressions are free Jexl text and do not — a rename that
  orphans a formula reference surfaces as the table's error
  line, never a crash.
- **Layout**: a table never runs past its page. A table wider than
  the column first **shrinks to fit** (2026-10-22, `fitTable`): its
  type - and its cell padding, which is in em - scales down until it
  fits, to 75% at most, re-fitting when the page or the table
  changes size (`table[data-fit]` records the scale). Only past that
  does the `.folio-table-scroll` wrapper scroll sideways INSIDE the
  measure (an eight-column table in a tracked-caps theme); numeric
  cells never wrap mid-value. Eight-column tables overflowed in most
  themes before, and a printout clipped them. Number and formula columns
  right-align, header included (ADR-0002: alignment derives from
  the column type). The rule is specific enough to beat the bidi
  `text-align: start` rule, which had silently left-aligned every
  number. e2e: `tests/e2e/table-layout.spec.ts`.
- **Guarded table render**: `renderTable` wraps `recalcTable` in
  try/catch. A broken formula (renamed column, bad reference,
  bad Jexl) renders the figure as an error line ("Table error:
  …") with the inspector still attached, so the expression can
  be fixed from the document view — the same contract as chart,
  diagram, and math error rendering.
- **Generated output is never editable in place**: the table
  element is contenteditable=false — header rows (the name span
  aside), data rows' formula cells, and the caption inherit it —
  so data cells and header names are the only editable leaves.
  Before this, clicking a header let you type into it: the DOM
  diverged from the model and the edit silently vanished on the
  next render. The caption is edited through the inspector (new
  field; empty removes it), exactly like the chart inspector's
  caption. Chart figures are contenteditable=false for the same
  reason (their SVG must never swallow typed text).

## Spreadsheet-style bar layout (2026-11-05)

The bar reads like a spreadsheet's, in the toolbar's visual language,
and it SAYS which column it configures - without plastering text on
it. Its rows are scoped, not accidental wraps:

- **Row 1 - table level** (`.insp-table-row`, full width), in a
  fixed order: the kind label, **Open dataset**, **Convert to table**,
  **Rows**, **Chart it** - kept to ONE line on a normal page: the
  kind label truncates with ellipsis (its title carries the full
  `@id`), and Rows + Chart it sit in a `.insp-pair` that wraps as one
  unit, so "Chart it" is never alone on a second line.
- **Row 2 - the caption** (`.insp-cap-row`): its own full-width line
  under the row-1 controls - a table's title is not a cramped side
  field.
- **Row 3 - the column editor group**: the column picker and all the
  column's formatting options - **visible**, type, unit, format - in
  ONE bordered group box (`.insp-group`, the header's group shape,
  full width, accent left edge). The box is the scope: the picker at
  its left edge (the name box, bold and borderless on the group's own
  background) names the column; everything inside applies to it.
- **Row 4 - the column's formula row**: directly under the group,
  same accent left edge, so rows 3-4 read as one column-editor block
  nearest the table (like Excel's formula bar above the grid).
- **The bar never overflows the page**: every full-width row
  (`insp-table-row`, `insp-group`, `insp-cap-row`, `insp-fx-row`)
  carries `min-width: 0`, so a wide row shrinks to the bar and
  scrolls/wraps inside itself instead of pushing the figure (and
  the page) wider. The column group wraps its controls (type, unit,
  format, select options + multi) onto extra lines inside the box
  when narrow; row 1 stays one line and scrolls sideways.
- **The inspected column lights up in the table**: `showInspector`
  stamps `figure[data-insp-col="c"]`; while the bar is visible
  (CSS `:has(> .folio-inspector:not([hidden]))`), that column's
  header gets an accent ring + underline and its cells the theme
  tint - Excel's selected column. The header keeps its own ink (an
  accent-colored label fails contrast on banded headers); print
  neutralizes the highlight with the bar. Cell clicks select the
  column too, and the highlight follows.
- **Dynamic names, no visible text**: the group's tooltip/aria-label
  reads "Formatting for column 'q2'" and the ƒx row's "Expression for
  column 'growth'", updated on every selection change.
- **Formula row**: ALWAYS present (a spreadsheet's formula bar never
  disappears): a full-width row directly under the column group, ƒx
  plus a
  textarea (`.insp-expr`, two rows, resizable, mono) big enough to
  edit a long expression. Enter applies, Shift+Enter is a newline.
  For a non-formula column the textarea is disabled with a
  placeholder saying how to make the column one ("set the type to
  formula..."); switching the type select in the group box to
  formula enables it, seeded with `0`. (The dataset browser's own
  formula bar, `.folio-ds-fbar`, is already full-width.)
- **Open dataset**: the button into the dataset browser is labelled
  (icon + "Open dataset"), not a bare glyph - the same action as the
  context menu's top item and the palette entry.

## Acceptance

- e2e: `tests/e2e/inspector.spec.ts` (reveal/hide, formula cell
  shows the expression, expr edit recalculates and reaches the
  source, unit edit updates the header and source, type change
  reaches the source, format select drives percent rendering,
  units visible in headers, header name editable while the unit
  is not, in-place rename reaches header/source/charts, rename
  on blur, rename breaking a formula shows the guarded error and
  no crash, Escape and empty renames revert, Tab/Enter header
  navigation; spreadsheet-style layout: column picker + format
  options in one group box with a dynamic "column 'x'" tooltip, the
  inspected column highlighted in the table (accent header ring,
  tinted cells) while the bar is open and not in print, the
  always-present full-width formula row (textarea, tall; disabled
  with a how-to placeholder until the type is formula, then enabled
  and seeded 0), labelled Open dataset button).
- First-contact eval: `evals/table-inspector-first-contact.md`.
- Documented in `demo/help/tables.md`.
- The right-click / Shift+F10 menu over a cell (insert, delete,
  clipboard, sort, hide) is its own spec:
  docs/specs/table-context-menu.md.
