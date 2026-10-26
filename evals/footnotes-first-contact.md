---
name: footnotes-first-contact
feature: footnotes (docs/specs/footnotes.md)
steps:
  - Open the Q3 Sales Review example and find its notes; follow one from the text and back.
  - In a new document, write two sentences and add a footnote to each without knowing any syntax.
  - Edit the first note's wording, then look at the Markdown view.
expected:
  - Notes are found from the visible affordances (+ Insert, or Ctrl+K "footnote").
  - References are numbered in order; the notes appear at the end under "Notes"; clicking a number jumps to its note and ↩ returns.
  - Editing a note in place changes its `[^n]: ...` line in the source, and nothing else.
  - The Markdown is GitHub's footnote syntax.
---
# First-contact eval: footnotes

A new user adds and edits footnotes without learning the syntax, and
the file stays plain GitHub Markdown.
