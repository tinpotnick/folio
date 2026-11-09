# ADR-0032: Motion figures — frame sequences as data, played in the open doc, static in print

Date: 2026-11-09

Status: accepted

## Context

folio documents are static by design (ADR-0004/0005): figures are
sanitized SVG, documents render fully offline, print is a rendition.
But "diagram with movement" (a flock, traffic on a road network, a
call network over a month) is a compelling way to show a system — and
the son's bio-inspired computing course is a real audience for it.

## Decision

A motion figure stores a **frame sequence as ordinary table rows** —
the time axis is a column in long format, never a nested structure —
and renders it as SVG frame groups. The open document plays the
sequence (Play/Stop in the figure header, the one inspector contract,
ABC-playback precedent); print/PDF shows a designed static rendition
of the same frames (filmstrip thumbnails, an aggregate flow map, a
poster frame) chosen per block by `display:` / `print:` keys. No SMIL,
no script in the SVG: the host swaps group visibility, so output
stays sanitized and identical across browser print, desktop
PrintToPdf and preview.

- **Determinism**: built-in sims are seeded (`mulberry32`), so the
  same document always yields the same sequence — and the same PDF.
- **Two frame sources**: a built-in seeded murmuration sim (no data), or
  any dataset with frame/id/x/y columns — including one a Python
  compute block published. Compute blocks gain a finite per-block
  `budget=N` (default 10 s, cap 120 s); a sim runs ONCE and publishes
  its frames as a snapshot table — nothing executes per tick, so the
  document renders fully with Python unloaded (ADR-0030 stands).
- **Not locked out**: renditions share one vocabulary; adding one is a
  renderer plus an enum value, validated with a visible error.

## Consequences

- One new block kind (`::: motion`), contained in the directive
  parser; the engine's table model is unchanged (the third dimension
  is a query, not a container).
- Frames are data: trajectory charts, group-bys and the dataset
  browser all work on them with no new code.
- New lazy-free renderer (`src/render/motion.ts`); figures are small
  (frame count capped).
