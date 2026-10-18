# Mermaid diagram blocks

## Status: accepted (2026-10-18) - ADR-0010

## Decision

Diagrams are semantic blocks rendered by Mermaid (ADR-0010: MIT,
actively maintained, no existing dependency covers diagram
rendering). Like charts, a diagram is generated output from the
document - never hand-drawn markup.

## Syntax

    ::: mermaid {#flow}
    graph TD
      A --> B
    :::

The body is raw Mermaid text until the closing `:::`. No inline
styling, no HTML in the body (Mermaid runs at securityLevel
"strict").

## Contract

- **Engine** (`src/engine/doc.ts`): `kind: "diagram"`, `diagram:
  { id, text }` - pure parse/serialize, unterminated diagrams are
  parse errors, round-trip identity holds.
- **Component**: renders `figure.folio-diagram` (non-editable) with
  the raw text as fallback content, then swaps in the rendered SVG
  asynchronously. Mermaid is dynamically imported only when a
  document contains a diagram - documents without diagrams never
  load it, and it is bundled, so rendering is fully offline
  (ADR-0005).
- **Toolbar**: the insert group's diagram button inserts a starter
  `::: mermaid` block (after the caret's block in document view;
  around the caret's paragraph in Markdown view).
- **Highlighter**: `::: mermaid` delimiters as directive tokens;
  body lines as code tokens.
- Broken diagrams show a `Diagram error: ...` message in place -
  the document still parses and round-trips (the diagram text is
  the source of truth, exactly like tables and charts).

## Acceptance

- `just lint`, `just test`, `just build` green; engine round-trip
  tests; e2e: diagram renders an SVG and round-trips; broken
  diagram shows an error without crashing.
