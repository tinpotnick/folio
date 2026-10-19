# ADR-0012: Jexl for table formula expressions

Date: 2026-10-18
Status: accepted

## Context

Formula columns in tables (ADR-0003) were evaluated by a
hand-written tokenizer/parser supporting only column arithmetic
(+, -, *, /, parentheses). Comparisons, conditionals, rounding -
basic report-writing operations - were out of reach, and growing a
grammar by hand is exactly the kind of unbounded maintenance
ADR-0007 warns about. ADR-0007 requires a dependency note for
every new dependency: license, maintenance, and why existing deps
do not cover it.

## Decision

Add `jexl` (MIT, v2.3.0) as an engine dependency and replace the
hand-written formula parser. Jexl is the de-facto standard
embedded expression language (used by no-code tools for safe
user-authored expressions): identifiers with a data context,
arithmetic, comparisons, logic, ternaries, string operations, and
pipe-syntax transforms. Maintenance is quiet but stable - the
grammar is small and frozen, which is what we want for a document
format.

No existing dependency evaluates expressions; mathjs is an order
of magnitude larger than needed for row-scoped formulas.

Semantics preserved from the hand-written engine (the tests are
the contract):

- Only NUMERIC columns are referenceable; anything else - unknown
  or text/formula columns - throws a visible error naming the
  column (Jexl alone would silently resolve unknowns to NaN).
- Division by zero yields 0 (blank fact, not an error) - kept by
  overriding the `/` binary operator.
- Non-finite results render as empty cells.
- Errors carry the table id and formula column name.

Added (documented in the in-app help): comparisons and ternaries
(e.g. `q3 > 400 ? "up" : "down"`), and the transforms
`round`, `floor`, `ceil`, `abs`, `min`, `max` (pipe syntax:
`growth * 100 | round(1)`).

## Consequences

- The engine gains a dependency but loses its parser; the
  grammar is now someone else's spec to maintain.
- `parseFormula`/`AstNode` are removed from the public API - the
  expression language is Jexl, not an AST contract.
- Update (2026-10-18, same day): the cross-row reference language
  (docs/specs/formulas.md) supersedes the original "chained
  formulas remain rejected" consequence - a formula may now
  reference formula columns to its LEFT, and the row context
  carries `_prev`/`_row`/`_r<N>`. Still plain Jexl plus context
  objects - no grammar extension. Everything else here is
  unchanged.
- The engine stays UI-free (ADR-0001) and fully testable
  headlessly; recalc is synchronous (`jexl.evalSync`).
