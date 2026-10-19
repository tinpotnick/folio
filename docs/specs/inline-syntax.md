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

**Selection resolution across engines.** In order: the shadow
root's selection (Chromium), then the component's drag-selection
tracking (every engine; the only option on WebKitGTK, the Tauri
engine, which exposes NO selection or caret API that pierces the
shadow boundary - `shadowRoot.getSelection` is missing and
`caretRangeFromPoint`/`caretPositionFromPoint`/`getComposedRanges`
all retarget to the shadow host, verified against 2.54). Without
the fallback every toolbar format click in the desktop app
reported "Select some text first". The drag tracking records the
press and release points of a mouse drag over the article and
builds the text Range between them: Chromium's
`caretRangeFromPoint` pierces, and where it does not the paragraph
is resolved with the shadow root's own `elementFromPoint` (the
one WebKit pierce) and the caret offsets are computed
geometrically from caret rects. Toggling follows the "what you
see is what you toggle" rule: the ancestor walk starts at the
first text position INSIDE the selection, so a selection that
begins exactly at a format boundary (the caret before a
`<strong>` and at its first text position are the same point)
still toggles the format its first visible character carries.
Verified end-to-end in WebKitGTK via MiniBrowser + WebKitWebDriver:
drag over a word, Bold applies `**word**` to the source, a second
drag over the bold word toggles it off, Italic applies the same
way; keyboard-driven selections are not resolvable on WebKitGTK
and are a known limitation (mouse drag is the supported gesture).

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
