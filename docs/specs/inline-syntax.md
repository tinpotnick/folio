# Inline syntax (markdown+)

## Status: accepted (2026-10-18)

## Decision

Prose carries semantic inline formats. The language targets GitHub
Flavored Markdown plus documented extensions ("markdown+"): anything
GitHub renders natively, plus folio additions.

## Syntax

| Format | Syntax | Renders | Source |
|---|---|---|---|
| Strong | `**text**` | `<strong>` | GFM |
| Emphasis | `*text*` | `<em>` | GFM |
| Strikethrough | `~~text~~` | `<del>` | GFM |
| Underline | `++text++` | `<ins>` | markdown+ (GFM has no underline; `++` follows the markdown-it `ins` convention) |
| Inline code | `` `text` `` | `<code>` | GFM |

Document-view toolbar buttons apply formats with the Range API
(`applyInlineFormat` on the component): `execCommand` cannot act on
a selection inside the shadow tree, so the old path silently did
nothing. The wrap is semantic (`strong`/`em`/`del`/`ins`), toggles
off by unwrapping, and the reflection recognizes both the semantic
tags and their legacy synonyms (`b`, `i`, `s`, `strike`, `u`).

Round-trip: `inlineMarkdownToHtml` / `htmlToInlineMarkdown` in
`src/render/inline.ts` are inverse across all five formats
(`<s>`/`<u>` from external pastes map to `~~`/`++` as well).

The source-view highlighter (`src/render/highlight.ts`) tokenizes
each format (`strike`, `underline` kinds); the host toolbar exposes
S / U buttons alongside B / I / code, reflecting and toggling in both
views like the other inline formats.

## Non-goals

- No style attributes ever travel in prose (AGENTS.md #1); the
  formats are semantic, rendered through the theme.
- HTML in documents is escaped, not interpreted.
