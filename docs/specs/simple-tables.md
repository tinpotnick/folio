# Simple tables and datasets

## Status: accepted (2026-10-21, ADR-0018)

## Decision

Two kinds of table, named in the UI:

| | **Table** (simple) | **Dataset** |
|---|---|---|
| Stored as | a standard Markdown pipe table | a `::: table {#id}` directive |
| Cells | text, exactly as written | typed (text, number, formula, ...) |
| Extras | none | id, units, formats, formulas, caption, import |
| Charts and formulas can use it | no | yes, by id |
| Created by | the Insert table button, "Insert a table" | "Insert a dataset", or "Make it a dataset" |

## Syntax and round-trip

- A pipe table STARTS at the beginning of a block: a `|` row
  followed by a delimiter row (`| --- | --: | :-: |`) with the same
  number of cells. A pipe line inside a paragraph, or one with no
  delimiter row, stays text.
- Rows continue while lines start with `|`. Short rows pad with
  empty cells; excess cells are dropped (GFM). `\|` is a literal
  pipe in a cell.
- **An author's formatting is kept**: a table whose content (names,
  alignments, cells) is unchanged re-serializes EXACTLY as written,
  in any spacing, so a GitHub diff shows only real edits. (The table
  remembers its source lines and a signature of their content.)
- Once edited, a table takes the canonical layout, which is
  Prettier's: each column padded to its widest cell (at least 3),
  content placed by its alignment (right-aligned columns pad on the
  left, centred columns split the gap), and delimiter dashes filling
  the width.
- Cells stay text. A typed number keeps its form ("0.90" stays
  "0.90"); only dataset NUMBER columns coerce.

## Rendering

The same folio table rendering as a dataset, using the theme's table
style. Alignment comes from the delimiter row; an unmarked column
whose every non-empty cell is a number right-aligns (ADR-0002). There
is no caption.

## The table bar

- Every table's bar starts with its KIND: "Table" or "Dataset · id",
  each with a tooltip saying what it is.
- A simple table's bar has only the column picker and **Make it a
  dataset**. Its tooltip says what a dataset adds. The conversion
  gives the table the first free id `table-N` and types each column
  as number when every non-empty cell is a number, text otherwise.
- A dataset's bar adds **Chart it**, which inserts a bar chart of
  its first text and first number/formula column right below it.
  It also has **Convert to simple table**, which converts only when
  nothing would be lost. Otherwise, pressing it shows the reason
  VISIBLY in the bar (not just in a hover tooltip), naming what
  blocks it: "growth is a formula, and formulas need a dataset",
  "1 chart uses this dataset", and so on.
- Conversions report their result on the host's status line
  (`folio-status` event): "Now a dataset (table-1) - Price is now a
  number column". A number column stores values, so `1.20` becomes
  `1.2`.
- **Inserting**: the table button and "Insert a table" create a
  simple table right after the caret's block, scroll it into view,
  and put the caret in its first cell; "Insert a dataset" does the
  same for a dataset. **Insert a chart** (palette) charts the dataset
  at the caret or the nearest one above, placing the chart after the
  caret's block (or in place of an empty line), or says that charts
  are drawn from a dataset. When the label column repeats (a long
  table: one row per month and region) the chart is split by the
  first other text column (`series:`), so it starts as one series
  per region rather than a bar per row.

## Acceptance

- Engine: `tests/engine/doc.test.ts` "simple (GFM pipe) tables"
  (parse with alignments and text cells, escaped pipes, Prettier
  round-trip, canonicalization, short rows, paragraph pipes and
  pipes without a delimiter row stay text, datasets unchanged).
- e2e: `tests/e2e/simple-tables.spec.ts` (renders and names its
  kind, numbers right-align, round-trips untouched; a cell edit
  stays a pipe table and does not rewrite "0.90"; Insert makes a
  pipe table AT THE CARET, in view; a hand-formatted table survives
  a view switch untouched; Make it a dataset (with its status) and
  back; the formula dataset refuses and says why, visibly; Chart it;
  the palette inserts a dataset, and Insert a chart explains when
  there is no dataset).
- First-contact eval: `evals/simple-tables-first-contact.md`.
