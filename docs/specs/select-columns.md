# Select columns: enum chips in tables

## Status: accepted (2026-11-10) - implemented on vibe/spec-next-features

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
  - {name: tags, type: select, options: [backend, frontend, design], multi: true}
  - {name: effort, type: number, align: right}
data:
  - ["Wireframes", done, "design, frontend", 3]
:::
```

## Rules

- `options:` is a closed key on the column (a flow list of bare words
  or quoted strings). `type: select` without `options` is a parse
  error; `options` without `type: select` is a parse error.
- **Single vs multi**: `type: select` is single-select (one value).
  `multi: true` on the column makes it multi-select: the cell holds a
  comma-separated list of options ("design, frontend"), rendered as
  one chip PER VALUE, and edited with a checkable dropdown (checkbox
  per option, tick toggles, Close commits). Single-select edits with
  a plain dropdown. `multi: true` without `type: select` is a parse
  error.
- Cells render as chips: rounded pill, theme tint background, ink
  text, one accent hue per distinct value (stable hash of the value
  into the theme's ramp, so the same status is the same color in
  every table and every chart legend). The full value is the chip
  label; the cell's `<title>` repeats it.
- Editing: click the cell → the dropdown opens in place; choosing
  commits (model write, like typing); Esc cancels. Keyboard: Enter
  opens, arrows choose, Enter commits. Multi: checkbox list, tick
  toggles a value in/out, Close/Enter commits the ticked set.
  The dataset browser (spreadsheet view) has the same controls:
  select cells render as chips there too, and click/Enter opens the
  same in-cell dropdown; the commit is one model write, so the
  in-document figure and the sheet both refresh.
- A value not in `options` (typed in Markdown by hand) is a visible
  cell error (chip drawn in the error style with the message in the
  title; for multi, each offending part flagged) - consistent with
  the formula-error contract. The document still parses and
  round-trips; the error is render-time.
- Select columns are ordinary data: formulas (`status == "done"`,
  multi: `tags =~ "design"` - substring match on the comma list),
  grouped queries (`group: [status]`), charts and totals all read
  them as text. Sorting is alphabetical, same as text; option ORDER
  is for the dropdown only.
- The inspector's column type select gains "select"; when selected,
  an options editor (comma-separated text field) and a **multi**
  checkbox appear in the column group - the same edit as the source.
- Round-trips byte-identically like every column key.

## Example

`demo/examples/project-plan.md`: a small plan with status/owner
select columns, an effort totals row, and charts grouped by status.
