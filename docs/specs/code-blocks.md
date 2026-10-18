# Code blocks (fenced)

## Status: accepted (2026-10-18)

## Decision

Fenced code blocks are a first-class block kind, per GitHub Flavored
Markdown: ``` with an optional language tag. Previously the toolbar
"code" button produced a bare `<pre>` in the DOM that the model
flattened back to prose - nothing durable happened.

## Contract

- **Model**: `{ kind: "code", lang?: string, text: string }` in
  `src/engine/doc.ts`. The parser collects fenced regions
  (3+ backticks + optional language) and errors on unterminated
  fences; the serializer emits ``` + lang fences. Round-trip
  identity holds (golden tests unaffected - the sample has no
  fences).
- **Render**: `pre.folio-code > code` (themed: mono, tinted
  background, pre-wrap). The source-view highlighter emits `fence`
  tokens for delimiter lines and `code` tokens for content.
- **Editing**: code blocks sync from the DOM as plain text via
  `innerText` (rendered line breaks become model newlines). Enter
  inside a code block inserts a line break instead of splitting the
  block.
- **Toolbar**: in document view the code button toggles the caret's
  block between prose and a code block (model-level; the caret is
  restored to the block after the re-render). It stays available
  inside code blocks - it is the way back - while the pure inline
  formats stay disabled there. In Markdown view the code button
  keeps its inline meaning: backticks around the selection.
- **Caret resolution**: the block at the caret resolves from the
  event target, the shadow selection, or the last clicked block
  (shadow-root hit testing) - the same engine-aware chain as the
  other caret-dependent features.

## Acceptance

- `just lint`, `just test`, `just build` green; engine round-trip
  tests for fences (with/without language, unterminated error);
  e2e: fence round-trip, toolbar conversion both directions, Enter
  inserts a newline.
