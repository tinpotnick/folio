# ADR-0018: Simple tables alongside datasets

Date: 2026-10-21

Status: accepted (refines ADR-0003)

## Context

ADR-0003 made every table a typed dataset, stored as a `::: table`
directive with YAML columns and rows. That is right for data: an id
for references, typed columns, units, formulas and captions have
nowhere to live in a standard Markdown table. But it made folio
hostile to everyone else:

- Pasting or opening a GitHub pipe table showed raw `|` text.
- Inserting "a table" wrote a `::: table` block, which a Markdown
  user (or anyone editing the file for GitHub) does not recognise,
  and which GitHub renders as a lump of YAML.

## Decision

There are two kinds of table, and the UI names them:

- **Table** (simple): a standard GitHub pipe table, stored as one.
  Cells are text exactly as written. Alignment comes from the
  delimiter row or, unmarked, is derived from the data (numbers
  right-align, per ADR-0002). There is no id, caption or types.
  This is what Insert creates.
- **Dataset**: the ADR-0003 typed table (`::: table`). Only datasets
  can be chart sources or formula references.

Conversion is EXPLICIT, from the table's bar: "Make it a dataset",
and "Convert to simple table" when nothing would be lost (no
formulas, units, formats, caption, import provenance, non-text or
number types, or references). Nothing promotes silently, so a
GitHub document never changes format behind its author's back.

An unedited pipe table re-serializes exactly as its author wrote it,
in any spacing. An edited one takes Prettier's layout, so diffs
stay honest.

## Consequences

- ADR-0003 still governs datasets. "Tables have typed columns from
  day one" now reads "datasets have typed columns"; a simple table
  is deliberately untyped text.
- Every cell-commit path must respect column type: text cells are
  never coerced to numbers. Before this, merely visiting "0.90"
  rewrote it as 0.9.
