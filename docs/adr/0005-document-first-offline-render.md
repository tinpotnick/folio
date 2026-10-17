# ADR-0005: Document-first; inline snapshots; offline render

Date: 2025-12-11
Status: accepted

## Context
The product is document-first, not notebook-first. Documents are
portable artifacts: send the doc, the recipient gets the data.

## Decision
Table data is always stored inline in the document (snapshot).
External bindings (CSV, JSON API, peer tables in other embedded
instances) are metadata plus last-synced snapshot; refresh is manual
or on-open, never required for rendering. There are no execution
affordances: no cells, no run buttons, no execution state. Recalc is
automatic and invisible.

## Consequences
- Any document renders with the network cut off.
- Bindings are an enhancement, not a dependency.
- Contrast with Jupyter is deliberate and must be preserved in UX.
