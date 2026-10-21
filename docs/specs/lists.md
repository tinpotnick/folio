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

Lists NEST (revised 2026-10-21): an item can hold a sub-list, which
can be bulleted or numbered independently of its parent:

```markdown
1. Prepare
   - fonts
   - colours
2. Ship
```

## Model

`{ kind: "list" } & ListBody`, where
`ListBody = { ordered: boolean; start?: number; items: ListItem[] }`
and `ListItem = { text: string; children?: ListBody }`. An item's
text is inline Markdown, exactly like a paragraph's (bold, italic,
code, links), and may contain `\n` from a wrapped source line.
`start` is kept only when a numbered list does not start at 1.

## Syntax and round-trip

- A list STARTS at the beginning of a block (after a blank line or
  another block) with a line `- `, `* `, or `+ ` (bulleted) or
  `N. ` / `N) ` (numbered). A list line in the middle of a paragraph
  stays paragraph text: that is conservative, and existing documents
  keep their meaning.
- The list continues over item lines and indented continuation
  lines; a blank line ends it.
- **Nesting**: an item line indented deeper than its parent's
  marker starts (or continues) that parent's sub-list. The canonical
  indent is the parent's content column (2 under `- `, 3 under
  `1. `); any deeper indent is accepted and canonicalizes. A
  sub-list's kind is set by its first item. A continuation line
  belongs to the deepest open item whose content column it reaches. `- a` / blank / `- b` is two lists, and
  it round-trips as two lists.
- Canonical form: bullets serialize as `- `; numbered items as
  `start`, `start+1`, ... with `. `; continuation lines are indented
  to the marker width (2 for `- `, 3 for `1. `), and sub-lists to
  their parent's content column. An empty item
  serializes as a bare marker (`-`).
- `serializeDoc(parseDoc(text)) === text` for canonical lists
  (`tests/engine/doc.test.ts`). `*`/`+` markers, `)` delimiters and
  other indents canonicalize on the next save.

## Rendering and editing

- A list renders as `<ul>` / `<ol start>` with one `<li>` per item;
  the theme styles it (spacing, marker color = the theme's muted
  ink).
- Editing is native, like paragraphs: Enter adds an item, and Enter
  on an empty item leaves the list for a new paragraph (in a
  sub-list, it lifts the item one level instead).
- **Tab** nests the caret's item under the item above it (joining
  that item's sub-list, or starting one of the same kind); it does
  nothing on a list's first item. **Shift+Tab** lifts a nested item
  one level, placing it right after its parent and taking its later
  siblings along as its own sub-list (order is kept). The caret
  stays put. The palette has **Indent list item (Tab)** and
  **Outdent list item (Shift+Tab)** (also found by "demote",
  "promote", "increase/decrease indent", "level").
- **In a sub-list, the list buttons act on THAT sub-list**: Bulleted
  or Numbered switches the sub-list's kind (a bulleted list under a
  numbered item), leaving the outer list alone; the same kind again
  is a no-op. The toolbar highlights the innermost list's kind.
  Typing `- ` or `1. ` into an EMPTY item sets its list's kind, at
  any depth. The
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
  nested lists: parse, mixed kinds, canonical round-trip, deeper
  indents canonicalize, continuation lines at depth).
- e2e: `tests/e2e/lists.spec.ts` (the sample's examples section
  renders as a `<ul>`; the toolbar buttons and palette entries
  toggle; Enter adds an item and reaches the source; Enter on an
  empty item exits; `- ` autoformat; and the regressions from the
  first-contact eval: the palette acts on the caret's block, a
  wrapped paragraph is one item, unlisting gives a paragraph per
  item, the palette reaches Paragraph; nesting: Tab nests and
  reaches the source, Shift+Tab lifts, the palette's Indent and
  Outdent; the buttons switch the caret's SUB-list; `- ` in an
  empty item; palette synonyms and shortcut hints).
- First-contact eval: `evals/lists-first-contact.md`.
