# Table formula reference language

## Status: accepted (2026-10-18)

## Decision

Formula columns evaluate Jexl (ADR-0012) against a ROW CONTEXT.
The reference language is plain Jexl plus context objects — no
folio-specific grammar is bolted on. Columns are addressed BY NAME
everywhere, never by spreadsheet coordinates; other rows are
addressed through row-context objects, so the implementation is
exactly "build a context, eval, map results".

## Reference forms

| Form | Meaning | Rules |
|---|---|---|
| `name` | Current row's value | Numeric or EARLIER formula columns only |
| `_prev.name` | Previous row's value | ANY column, including the formula's own — the running-total form |
| `_r4.name` | Row 4's value (1-based) | ANY column; out-of-range rows read empty (undefined -> NaN) |
| `_row` | Current row number (1-based) | Always available |

- **Running totals**: `q2 + (_row == 1 ? 0 : _prev.total)` — row 1
  has no previous row (`_prev` reads NaN), hence the guard.
- **Chaining**: formula columns compute left to right; a formula
  may reference formula columns to its LEFT. A later formula
  column is an error ("a formula may only reference columns to its
  left"); a plain reference to the formula's own column is a
  self-reference error pointing at `_prev.name`.
- **Computation order in row references**: earlier formula columns
  are fully computed before the next formula starts, so `_r3.b`
  from an earlier column works at any row; the OWN column is only
  computed for rows above the current one — forward self-references
  read empty. This is why running totals use `_prev`, not absolute
  self-references.
- **Why `_rN.name` and not `q2:4`**: a colon-glued syntax would be
  a folio grammar extension requiring pre-evaluation rewriting and
  a no-spaces ternary disambiguation rule; `_rN` is an ordinary
  Jexl identifier, `_rN.name` ordinary property access, and an
  out-of-range row simply resolves to `undefined` (verified against
  Jexl 2.3.0). The language stays exactly "Jexl + documented
  context".
- **Errors** carry the table id and formula column name. Unknown
  columns are rejected by name in the message. Plain names are
  numeric-only (text columns throw); `_prev`/`_rN` may read text
  columns for cross-row comparisons.
- Division by zero yields 0; non-finite results render empty
  (reporting contract, ADR-0012).

## Recalculation

Editing any cell recomputes the WHOLE table and refreshes every
formula cell in place (text-only updates, no structural
re-render, caret untouched) plus dependent charts — because a
formula may now depend on rows other than its own.

## Acceptance

- Engine: `tests/engine/recalc.test.ts` (row references, refs into
  formula history, running totals, forward/empty, chaining allowed
  left / rejected right, self-reference, row 0, text columns
  through the row context, unknown columns).
- e2e: `tests/e2e/editor.spec.ts` (running totals render and
  recalculate on edit; `_rN.name` row references).
- Documented in `demo/help.md`; engine contract in ADR-0012.
