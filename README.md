# folio

A document-first workspace. Semantic Markdown documents where tables
are typed datasets, charts are queries over them, and the rendered
output reads like a polished report — not a notebook.

## Principles

- **Document-first.** The document is the artifact: prose, live
  tables, figures in one portable, offline-renderable file.
- **Semantic Markdown only.** No inline styling. Style lives in
  themes with a closed, typed schema.
- **Tables are typed datasets** — grid, dataset, and relation in one.
- **Charts are queries**, not widgets. Edit the table, the figure
  updates. No run buttons, no execution state.
- **Embeddable.** The editor is a framework-agnostic web component;
  our apps are hosts of it.
- **AI-first development.** Every subsystem has a machine-checkable
  contract. See AGENTS.md and docs/adr/.

## Repository layout

- `AGENTS.md` — standing orders for AI agents
- `docs/adr/` — architecture decision records (read before
  architectural changes)
- `docs/specs/` — specs, including the north-star sample document
- `docs/blockers/` — agent stop-and-report files
- `tests/golden/` — lossless round-trip golden files
- `evals/` — behavior eval set grown from real bugs

## Status

Pre-code. The seed kit (specs, ADRs, standing orders) is in place;
the first milestone is the table-block parse/serialize round-trip
with formula recalc, verified headlessly against the sample document.
