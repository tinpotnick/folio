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
- **Controls**: column select (switch inspected column), type
  select (text / number / formula), unit (shown in the header as
  "(unit)"), format (plain / percent), and for formula columns
  the ƒx expression input (Enter or blur applies).
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

## Acceptance

- e2e: `tests/e2e/inspector.spec.ts` (reveal/hide, formula cell
  shows the expression, expr edit recalculates and reaches the
  source, unit edit updates the header and source, type change
  reaches the source, format select drives percent rendering,
  units visible in headers, header name editable while the unit
  is not, in-place rename reaches header/source/charts, rename
  on blur, rename breaking a formula shows the guarded error and
  no crash, Escape and empty renames revert, Tab/Enter header
  navigation).
- First-contact eval: `evals/table-inspector-first-contact.md`.
- Documented in `demo/help.md`.
