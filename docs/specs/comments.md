# Comments (document review)

## Status: accepted (2026-11-20) - implemented on vibe/comments-save-conflicts

## Decision

Reviews are typed blocks inside the document itself, using the same
`:::` container syntax as tables and charts (`src/engine/doc.ts:81`):

```
::: comment {#c-17}
anchor: @regional-data
quote: "Growth was strongest"
author: nick
created: 2026-11-20
resolved: false
in-reply-to: @c-12
Growth was strongest - but is that pre- or post- the pricing change?
:::
```

No sidecar file: the review travels with the document, diffs cleanly
in git, and renders fully offline (ADR-0005). The document stays
semantic - a comment is data, never inline styling (ADR-0002); how it
is drawn is the theme's job.

## Contract

- **Model** (`src/engine/doc.ts`): new block kind `comment` in the
  block schema (docs/specs/block-schema.md):
  - `id`: stable anchor id, same namespace as other blocks
  - `anchor`: `@block-id` of the block commented on; omitted =
    document-level comment
  - `quote`: exact quoted text inside the anchor block, used for
    highlighting and re-anchoring after edits elsewhere in the doc
  - `author`: free text, supplied by the host profile (never invented
    silently; if unknown, the insert dialog asks once and remembers)
  - `created`: ISO date; `resolved`: bool
  - `in-reply-to`: optional `@comment-id` - threads are flat blocks,
    not nesting
  - body: free text lines until the closing `:::`
- **Round-trip:** parse -> serialize is byte-identical;
  `tests/golden/comments.md` is a golden file (block-schema invariant
  2). The parser/serializer gain one `comment` branch each, mirroring
  the `value` block. The header/body separator blank is emitted only
  when the body's first line could be mistaken for a header key, so
  the canonical form stays tight.
- **Anchoring prose:** prose and list blocks have no id of their own;
  a comment on them anchors to the nearest preceding heading's slug,
  and the quote highlight searches that whole section. The highlight
  itself is best effort: the quote is marked when it sits in a single
  text node; the comment's own quote chip always shows it.
- **Render:** the quoted range inside the anchor block gets a
  theme-styled highlight; the comment itself renders as an aside at
  the anchor point (document-level comments at the end). Resolved
  comments render collapsed; a toggle shows/hides resolved ones.
  Clicking a highlight or a comment chip toggles its thread; Esc
  dismisses - the same reveal/dismiss contract as figure inspectors
  (docs/specs/figure-inspectors.md), no close buttons. Comments are
  hidden in print.
- **Editing:** palette commands "Add a comment" (at the caret, or on
  the current selection - the selection becomes the quote), "Resolve
  comment" / "Unresolve", "Delete comment" - each also an in-app-help
  entry in the same change (ADR-0009). Comment bodies are edited in
  place like prose. Every command is undoable. "Add a comment" is
  also the document context menu's entry and Insert › Comment in the
  toolbar - one implementation (docs/specs/context-menu.md).
- **Insertion rules:** a selection inside a table cell quotes the cell
  text and anchors to the table; a selection spanning blocks anchors
  to the first block and quotes its portion. No selection = anchors to
  the current block with an empty quote.
- **Identity:** `author`/`created` are written at insert time and are
  plain editable fields - folio does not enforce authorship.
- **Trailing comment:** a comment aside is a non-editable block like a
  figure: clicking below a trailing one appends a paragraph, and Enter
  with the comment selected opens a paragraph after it (the body island
  keeps its own Enter). The comment body and its buttons own their
  keystrokes.
- **Live editing interplay:** deferred. Comment ids are stable block
  anchors, so a future CRDT layer can merge comment blocks without
  special cases.

## Acceptance

- Golden: `tests/golden/comments.md` byte-identical round-trip,
  including a threaded pair, a document-level comment, and a comment
  on a table cell.
- e2e (`tests/e2e/comments.spec.ts`): insert on a selection, quote
  highlight anchors after an edit elsewhere, resolve toggle, delete,
  undo, print hides comments.
- WebKitGTK: `tests/webkitgtk/comments.js` native case for selection
  quoting (the engine-matrix rule: selection handling is verified in
  both engines).
- Palette + in-app-help entries exist and are discoverable by the words
  "comment", "resolve", "review".
- First-contact eval: `evals/comments-first-contact.md` - a new user
  comments on a paragraph, replies, and resolves, using only visible
  affordances.
