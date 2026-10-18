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
- **Toolbar**: the code-block button lives in the insert group
  (table / diagram / code) with a `</>` icon. In document view it
  toggles the caret's block between prose and a code block
  (model-level; the caret is restored to the block after the
  re-render) and reflects the caret's block. In Markdown view it
  fences the caret's whole paragraph (blank-line delimited). The
  inline format bar keeps only inline formats; inline code is typed
  as backticks in the source.
- **Caret resolution**: the block at the caret resolves from the
  event target, the shadow selection, or the last clicked block
  (shadow-root hit testing) - the same engine-aware chain as the
  other caret-dependent features.

## Acceptance

- `just lint`, `just test`, `just build` green; engine round-trip
  tests for fences (with/without language, unterminated error);
  e2e: fence round-trip, toolbar conversion both directions, Enter
  inserts a newline.
