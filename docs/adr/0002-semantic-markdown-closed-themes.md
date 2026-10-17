# ADR-0002: Semantic Markdown only; closed typed theme schema

Date: 2025-12-11
Status: accepted

## Context
WYSIWYG/Markdown duality must round-trip losslessly, and output must
be publication-quality without Word-style per-character styling.

## Decision
Markdown is the content layer and is strictly semantic: no inline
font/color/size styling ever exists in a document. Style lives in
themes. A document may reference a named theme plus typed overrides
in frontmatter (e.g. h1.font.size: 28pt). The theme schema is closed
and typed — not arbitrary CSS. Table formatting derives from column
types (e.g. numbers right-align); alignment is never stored per cell
or per column in the document.

## Consequences
- Lossless round-trip and diffability by construction.
- Retheming restyles every document instantly.
- Adding a style knob requires a schema change (deliberate friction).
