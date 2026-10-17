# ADR-0004: Charts are queries over table data

Date: 2025-12-11
Status: accepted

## Context
Charts must stay correct when tables change, and reporting must be a
first-class use.

## Decision
A chart block never stores data. It stores a source table reference
and a query (select/filter/group/aggregate/sort). Charts render by
executing the query against the typed dataset at render time. Chart
output must be publication-quality vector (SVG) with interactivity as
progressive enhancement.

## Consequences
- Editing a table re-renders dependent charts automatically (recalc
  graph), consistent with the no-execution-affordances principle.
- The query language is small, typed, and engine-owned.
- Export (e.g. PDF) embeds SVG directly.
