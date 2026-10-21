# Lists

## Status: accepted (2026-10-21)

## Decision

Bulleted and numbered lists are a block type, `list`, the Markdown
everyone already writes:

```markdown
- First point, with **inline** formatting and [links](x.md)
- A long item may wrap onto
  an indented continuation line

1. Numbered items
2. number themselves on save
```

Before this, folio had no lists at all: `- item` lines were a
paragraph, so every bullet rendered as a literal dash run together
with its neighbours, including the sample's "More examples" and the
whole help document.

Lists are FLAT in this version: one level, bulleted or numbered.
Nesting is a deliberate follow-up. An indented `  - sub` line
round-trips byte-for-byte as continuation text of its item, so no
document loses anything, but it renders as text, not as a sub-list.

## Model

`{ kind: "list"; ordered: boolean; start?: number; items: string[] }`.
Each item is inline Markdown, exactly like a paragraph's text (bold,
italic, code, links), and may contain `\n` from a wrapped source
line. `start` is kept only when a numbered list does not start at
1.

## Syntax and round-trip

- A list STARTS at the beginning of a block (after a blank line or
  another block) with a line `- `, `* `, or `+ ` (bulleted) or
  `N. ` / `N) ` (numbered). A list line in the middle of a paragraph
  stays paragraph text: that is conservative, and existing documents
  keep their meaning.
- The list continues over item lines and indented continuation
  lines; a blank line ends it. `- a` / blank / `- b` is two lists, and
  it round-trips as two lists.
- Canonical form: bullets serialize as `- `; numbered items as
  `start`, `start+1`, ... with `. `; continuation lines are indented
  to the marker width (2 for `- `, 3 for `1. `). An empty item
  serializes as a bare marker (`-`).
- `serializeDoc(parseDoc(text)) === text` for canonical lists
  (`tests/engine/doc.test.ts`). `*`/`+` markers, `)` delimiters and
  other indents canonicalize on the next save.

## Rendering and editing

- A list renders as `<ul>` / `<ol start>` with one `<li>` per item;
  the theme styles it (spacing, marker color = the theme's muted
  ink).
- Editing is native, like paragraphs: Enter adds an item, and Enter
  on an empty item leaves the list for a new paragraph. The
  structural sync (`syncFromDom`) reads `UL`/`OL` back into list
  blocks, so whatever the engine does round-trips through the
  model.
- Inline formatting and links work inside items exactly as in
  paragraphs.
- **Commands**: toolbar buttons "Bulleted list" and "Numbered list"
  toggle the caret's block. A paragraph or heading becomes a
  ONE-item list: its source line breaks are soft wraps, not items. A
  list of the same kind unlists into ONE PARAGRAPH PER ITEM, and so
  do P/H1-H3 on a list (merging items into one paragraph would run
  them together). A list of the other kind switches between
  bulleted and numbered. Palette entries carry the same names
  (keywords include "bullet list", "ordered list", "remove list"),
  and the palette also has Paragraph and Heading 1-3, so a list can
  be turned back into text by searching "paragraph", "normal text"
  or "remove list".
- **The caret's block** is tracked on every selection change, so a
  command run from the palette (which takes focus) acts on the block
  the caret was in, not the last block clicked.
- **Autoformat**: typing `- ` or `1. ` at the start of an empty
  paragraph turns it into a list, the Markdown habit.

## Acceptance

- Engine: `tests/engine/doc.test.ts` "lists" (parse bulleted and
  numbered, continuation lines, start number, blank-separated lists,
  mid-paragraph dashes stay prose, canonical round-trip, nested
  lines preserved as text).
- e2e: `tests/e2e/lists.spec.ts` (the sample's examples section
  renders as a `<ul>`; the toolbar buttons and palette entries
  toggle; Enter adds an item and reaches the source; Enter on an
  empty item exits; `- ` autoformat; and the regressions from the
  first-contact eval: the palette acts on the caret's block, a
  wrapped paragraph is one item, unlisting gives a paragraph per
  item, the palette reaches Paragraph).
- First-contact eval: `evals/lists-first-contact.md`.
