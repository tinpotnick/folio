# Select columns: enum chips in tables

## Status: proposed (2026-11-10)

## Decision

A column of `type: select` is a closed enum: the column declares its
options, cells render the value as a **chip**, and editing a cell is
a dropdown of those options. This is the project-planning primitive
(status: todo / doing / done; owner; priority) - and it is what makes
a table read as a plan instead of a grid of text.

```
::: table {#plan}
columns:
  - {name: task, type: text}
  - {name: status, type: select, options: [todo, doing, done]}
  - {name: effort, type: number, align: right}
data:
  - ["Wireframes", done, 3]
:::
```

## Rules

- `options:` is a closed key on the column (a flow list of bare words
  or quoted strings). `type: select` without `options` is a parse
  error; `options` without `type: select` is a parse error.
- Cells render as chips: rounded pill, theme tint background, ink
  text, one accent hue per distinct value (stable hash of the value
  into the theme's ramp, so the same status is the same color in
  every table and every chart legend). The full value is the chip
  label; the cell's `<title>` repeats it.
- Editing: click the cell → a dropdown (`<select>`) of the options
  opens in place; choosing commits (model write, like typing); Esc
  cancels. Keyboard: Enter opens, arrows choose, Enter commits.
- A value not in `options` (typed in Markdown by hand) is a visible
  cell error (chip drawn in the error style with the message in the
  title) - consistent with the formula-error contract. The document
  still parses and round-trips; the error is render-time.
- Select columns are ordinary data: formulas (`status == "done"`),
  grouped queries (`group: [status]`), charts and totals all read
  them as text. Sorting is lexicographic by option order? No -
  alphabetical, same as text; option ORDER is for the dropdown only.
- The inspector's column type select gains "select"; when selected,
  an options editor (comma-separated text field) appears in the column
  group - the same edit as the source.
- Round-trips byte-identically like every column key.

## Example

`demo/examples/project-plan.md`: a small plan with status/owner
select columns, an effort totals row, and charts grouped by status.
