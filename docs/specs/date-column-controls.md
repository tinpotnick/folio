# Date and datetime column controls

## Status: accepted (2026-11-10) - implemented on vibe/spec-next-features

## Decision

Columns of `type: date` (and the new `type: datetime`) get a real
control when edited: click the cell and a calendar (date picker) or
date+time picker opens in place — the project-planning "target date"
case. The document stores ISO text, as today; the control is a
render-time affordance.

```
::: table {#plan}
columns:
  - {name: task, type: text}
  - {name: target, type: date}
  - {name: review, type: datetime}
data:
  - ["Wireframes", 2026-11-12, 2026-11-12T14:30]
:::
```

## Rules

- `type: date` holds `YYYY-MM-DD`; `type: datetime` holds
  `YYYY-MM-DDTHH:MM` (local, no zone - folio documents are offline
  snapshots; zones are a later decision, not smuggled in). Both are
  text cells in the model; the existing `.date` cell class formats
  them for display (date: `2026-11-12` → locale short date; datetime
  adds the time).
- Editing: the cell stays text-editable (type the ISO value, as
  today); the **calendar icon** in the cell (shown on hover/focus)
  goes STRAIGHT to the native calendar: an invisible `<input
type="date">` (or `type="datetime-local">`) anchored over the cell
  calls `showPicker()` from the icon click, so the calendar opens at
  the cell - no intermediate pop with segmented MM/DD/YYYY fields.
  Where `showPicker` is unsupported, re-clicking the icon retries and
  the cell body still accepts a typed ISO value. Picking a value
  commits immediately (model write); Esc or an outside click closes;
  clearing the input writes blank. Keyboard: focus + ArrowDown/Space
  opens the picker, Enter commits. In the dataset browser (spreadsheet
  view) date/datetime cells carry the same calendar icon opening the
  same picker; the cell body stays text-editable there too.
- A malformed value typed in Markdown is a visible cell error
  (existing date-error contract), document still round-trips.
- `datetime` joins `ColumnType`; `type: datetime` parses/serializes
  like the other types; existing `type: date` behavior is unchanged.
- Sorting, formulas (`target < "2026-12-01"` compares ISO strings —
  correct lexicographically), queries and charts treat them as the
  text they are; a date-typed chart axis already reads ISO spans
  (chart-rendering.md xLabel).
- The inspector's type select gains "date" and "datetime".

## Example

`demo/examples/project-plan.md`: a `target` date column and a
`review` datetime column, both picker-editable.
