# Table of contents

## Status: accepted (2026-10-26)

## Decision

A line `[[_TOC_]]` - the marker GitLab and Azure DevOps render -
becomes a contents list of the document's headings. `[TOC]`
(Python-Markdown, Bitbucket and many editors) is read too, and the
marker is kept exactly as written.

## Contract

- **Model:** `{ kind: "toc"; marker }`, its own block; the marker ends a
  paragraph. Round-trips byte-identically.
- **Rendering** (`renderContents`): `nav.folio-toc` ("Contents"), the
  headings as nested ordered lists, three levels deep. A document with
  exactly one H1 treats it as the title and lists from H2. Rebuilt on
  every change, only when the headings changed. With no headings it
  says "Headings will be listed here."
- **Navigation:** an entry is a link without `href`; clicking it
  reveals the heading (the section browser's `revealBlock`: lands below
  the toolbar, caret in the heading).
- **Inserting:** "Insert a table of contents" / **+ Insert › Table of
  contents** inserts `[[_TOC_]]` after the caret's block (or in place
  of an empty line).
- **Print / PDF:** the contents print without page numbers - browsers'
  print engines cannot yet put page numbers in it (CSS
  `target-counter`); see docs/specs/print.md.
- Styling: themes' rules, muted uppercase title, top-level entries
  semibold, the accent on hover.

## Acceptance

- Unit: `tests/engine/doc.test.ts` (markers round-trip). e2e:
  `tests/e2e/contents.spec.ts`. Eval: `evals/contents-first-contact.md`.
