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
- **Units in headers**: `th` renders "name (unit)" with the unit
  in a muted span; the sample document's "£k" is finally visible.

## Acceptance

- e2e: `tests/e2e/inspector.spec.ts` (reveal/hide, formula cell
  shows the expression, expr edit recalculates and reaches the
  source, unit edit updates the header and source, type change
  reaches the source, format select drives percent rendering,
  units visible in headers).
- First-contact eval: `evals/table-inspector-first-contact.md`.
- Documented in `demo/help.md`.
