# Bidirectional text (right-to-left scripts)

## Status: accepted (2026-10-18)

## Decision

Arabic, Hebrew, and other right-to-left scripts justify to the
right; Latin documents are untouched. Direction and justification
are TYPOGRAPHY: they live in the theme (ADR-0002), never in the
document (AGENTS.md #1 - no dir attributes, no style literals).

## Contract

- Every text block element (h1/h2, p, figcaption, table cells)
  gets `unicode-bidi: plaintext; text-align: start` in
  `themeCss`. With `plaintext`, each block's direction derives
  from its first strong character: an Arabic paragraph is RTL and
  start-aligns to the right; an English paragraph in the same
  document is unchanged. Numeric-only cells have no strong
  character and stay LTR.
- Table numeric alignment (`td.num { text-align: right }`) and
  centered captions override the base rule (later in the sheet).
- The document model carries no direction: the same paragraph
  renders appropriately in any theme, and the Markdown source is
  plain text either way.
- Editing works inside plaintext blocks in both engines (the
  browser manages the bidi caret; no folio code touches direction).

## Acceptance

- e2e: `tests/e2e/rtl.spec.ts` (Arabic paragraph right-aligns
  while English stays left; Arabic table cell right-aligns
  modulo cell padding; Arabic prose round-trips through the
  source view).
- First-contact eval: `evals/bidi-first-contact.md`.
