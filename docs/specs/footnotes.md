# Footnotes

## Status: accepted (2026-10-26)

## Decision

Footnotes use GitHub's syntax, which GitHub, GitLab, Pandoc and
Obsidian all render: a reference `[^label]` in the text, and a
definition `[^label]: the note` on its own line (continuation lines
indented four spaces). The label is any word (`1`, `source`); the
reader sees numbers.

## Contract

- **Model** (`src/engine/doc.ts`): consecutive definition lines are
  one `footnotes` block `{ notes: { label, text }[] }` (so they
  round-trip without gaining blank lines); a continuation line joins
  the text with a newline. A definition line ends a paragraph.
  Round-trip: `tests/golden/footnotes.md` is byte-identical.
- **References** (`src/render/inline.ts`): `[^label]` renders as
  `sup.folio-fnref[data-fn]` holding a link with no `href` (it jumps
  within the page; the link handler ignores it), and converts back to
  `[^label]`. Labels are `[\w.-]+`.
- **Numbering:** in reading order of first reference; a label used
  twice reuses its number. A reference's tooltip is its note.
- **Notes section:** the definitions are not shown where they are
  written (a hidden `aside.folio-fndefs` keeps the block indexes 1:1);
  the page ends with a generated `section.folio-notes` ("Notes"): one
  entry per note in number order, then notes nothing refers to; a
  reference without a definition shows "No note for [^x] yet". It is
  rebuilt when the references change, never while the caret is in a
  note.
- **Editing a note:** in place, in the Notes section. The note handles
  its own keys and input (the article's caret handling must not see
  them): Enter does nothing (one paragraph), Home/End stay within the
  note (the browser's End jumped past the ↩ into the next note), and
  each edit writes back to the definition and records an undo step.
- **Navigation:** clicking a number scrolls to its note; the note's ↩
  scrolls back to the first reference. ↩ is hidden in print.
- **Inserting:** "Insert a footnote" (palette; **+ Insert › Footnote**)
  inserts the next free numeric label at the caret, adds an empty
  definition to the footnote block at the end of the document (or
  starts one), and puts the caret in the new note ("Type the note…").
  Outside a paragraph or list item it says where to put the cursor.
- **Print / PDF:** the notes print at the end of the document, as
  GitHub shows them. Bottom-of-page footnotes are not supported by
  browser print engines today.
- **Styling** (themes): references are small superscripts in the
  theme's accent; the Notes section is smaller, under a hairline rule.

## Acceptance

- Unit: `tests/engine/doc.test.ts` (round-trip, grouping, a definition
  ending a paragraph), `tests/render/footnote-inline.test.ts`.
- e2e: `tests/e2e/footnotes.spec.ts`. WebKitGTK:
  `tests/webkitgtk/footnote-native.js`.
- First-contact eval: `evals/footnotes-first-contact.md`.
