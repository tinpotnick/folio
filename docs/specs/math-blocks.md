# Math blocks (display equations)

## Status: accepted (2026-10-18)

## Decision

Display equations are a first-class block kind, per the markdown+
extensions: a fenced `$$` block carrying LaTeX source, rendered
typeset with KaTeX (ADR-0011: MIT, bundled, loaded lazily like
mermaid). Inline `$...$` notation is a LATER extension - it
collides with prose dollar signs and is not implemented.

## Contract

- **Model**: `{ kind: "math", text: string }` in
  `src/engine/doc.ts`. The parser collects `$$`-delimited regions
  (a lone `$$` line opens, the next lone `$$` line closes) and
  errors on unterminated blocks; the serializer emits `$$` fences.
  Round-trip identity holds (byte-identical for canonical input).
- **Render**: `figure.folio-math > .math-holder` (theme CSS:
  centered display math, horizontal overflow scroll). KaTeX's
  stylesheet is injected into the component's shadow root on first
  use (vite `?inline`; a scoped tree cannot see page CSS) - fonts
  and styles render fully offline.
- **Errors as content**: `throwOnError: false` renders bad LaTeX
  as visible red text inside the math - the same contract as
  diagram errors. A broken equation never breaks the render or
  the parse.
- **Editing**: math blocks are generated output (like
  tables/charts/diagrams): read-only in the document view,
  preserved by figure identity through structural syncs, and
  never split by Enter. The LaTeX is edited in the Markdown view.
- **Source view**: `$$` delimiter and content lines highlight as
  the `math` token kind (`.tk-math`, purple tint).

## Acceptance

- Unit: `tests/engine/doc.test.ts` (parse, byte-identity,
  unterminated error, prose does not swallow a following `$$`),
  `tests/render/highlight.test.ts` (math tokens, resumption after
  the closing `$$`).
- e2e: `tests/e2e/math.spec.ts` (renders typeset, round-trip,
  error-as-content, survives prose edits, Enter no-split, source
  highlighting).
- First-contact eval: `evals/math-first-contact.md`.
- ADR-0011 records the KaTeX dependency decision.
