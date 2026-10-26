---
name: contents-first-contact
feature: table of contents (docs/specs/contents.md)
steps:
  - In a document with several sections, add a table of contents without knowing any syntax.
  - Use it to jump to a section near the end.
  - Add a new section and rename an existing one.
expected:
  - The contents is found from visible affordances (+ Insert, or Ctrl+K "contents").
  - It lists the sections, nested, without the document's title; an entry jumps to its section.
  - It updates itself after the new and renamed sections.
---
# First-contact eval: table of contents

A new user adds a contents list that stays right by itself.
