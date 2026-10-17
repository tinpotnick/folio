# ADR-0003: Tables are typed datasets

Date: 2025-12-11
Status: accepted

## Context
A table must simultaneously be an editable grid, a filterable dataset,
and a relation (for charts, queries, and cross-table references).

## Decision
Tables have typed columns (text, number, date, select, formula,
relation) from day one. Cell formatting is derived from the column
type and theme, never stored inline. Cross-table references are
relation columns resolved by the engine.

## Consequences
- Charts and database views fall out of the type system.
- Retrofitting types later would be a rewrite; this is non-negotiable.
- The engine must validate type constraints on every edit.
