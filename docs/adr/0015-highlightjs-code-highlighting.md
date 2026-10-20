# ADR-0015: highlight.js for code block syntax highlighting

Date: 2026-10-20

Status: accepted

## Context

Fenced code blocks (docs/specs/code-blocks.md) rendered as plain
monospace text. A document that reads like a polished report needs
code colored by language, and the new code header lets the author
pick that language. ADR-0007 requires a dependency note for every
new dependency.

## Decision

Add `highlight.js` (v11, **BSD-3-Clause**) as a runtime dependency
for syntax highlighting in the document view.

- **License:** BSD-3-Clause - permissive, no copyleft concerns.
- **Maintenance:** mature, long-lived project with regular
  releases (11.12.0 at adoption).
- **Why not existing deps:** nothing in the tree tokenizes
  programming languages. folio's own `src/render/highlight.ts`
  colors Markdown only; growing it into many language grammars
  would be reinventing a solved problem.
- **Why highlight.js over the alternatives:** Prism (MIT) is
  lighter but its maintenance has slowed; Shiki (MIT) is the most
  accurate but ships large TextMate grammars plus a regex engine
  and theme JSON that would sit outside folio's closed theme
  schema. highlight.js has a small core, per-language grammars
  that load independently, synchronous tokenizing, and plain
  token class names folio's theme can color.
- **Offline rendering (ADR-0005):** bundled, never fetched. The
  core and each grammar are dynamically imported on first use, so
  a document without code pays nothing, and a document pays only
  for the languages it uses (the Mermaid/KaTeX pattern,
  ADR-0010/0011).
- **Themes own style (ADR-0002):** highlight.js emits token
  classes only; the colors live in the theme CSS
  (`src/render/theme.ts`). Documents carry nothing but the fence's
  language tag.
- **Engine stays UI-free (ADR-0001):** highlighting is render-only
  (`src/render/code.ts`); the model, parser and serializer are
  untouched, and round-trip identity holds - highlighting paints
  spans over the text and the model reads the text back.

## Consequences

- Supported languages are a curated list (`CODE_LANGUAGES`);
  adding one is a grammar loader entry plus a picker entry.
- The Markdown (source) view still colors fences with its own
  fence/code tokens; per-language coloring there is not covered by
  this decision.
