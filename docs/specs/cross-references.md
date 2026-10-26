# Cross-references and numbered captions

## Status: accepted (2026-10-26)

## Decision

Tables and figures are numbered, and the text refers to them by id,
in Pandoc-crossref's syntax (also Quarto's): `@tbl:id`, `@fig:id`,
`@sec:id`. "See @tbl:regional-revenue" reads "See Table 1", and stays
right as things move. Ids are the ones folio already has: a dataset's
`{#id}`, a chart's, an image's, a diagram's; a heading's id is its
GitHub-style slug (`## Against target` → `against-target`).

## Contract

- **Numbering** (`crossRefTargets`): in reading order, separately for
  tables (datasets; simple pipe tables have no id or caption) and
  figures (charts, images, diagrams). Every captioned one is numbered;
  an uncaptioned one only when a reference names it.
- **Captions** show the number - "Table 2. Revenue by product line" -
  drawn by CSS from `figcaption[data-label]`, so the caption text the
  author edits stays their own.
- **References** (`src/render/inline.ts`): `@tbl|fig|sec:id` (not after
  a word character - email addresses are left alone) renders as
  `a.folio-xref[data-ref]` with no `href`, and converts back exactly.
  The component fills in "Table 2" / "Figure 3"; a section reference
  shows the heading's text (headings are not numbered). An unknown id
  shows a muted "table ?" with a tooltip naming the missing id.
  Clicking a reference scrolls to its target.
- **Renumbering** happens on every change (render, typing, inspector
  edits), so numbers and references never go stale.
- **Inserting:** "Insert a cross-reference" / **+ Insert ›
  Cross-reference** opens the palette on one entry per target -
  "Cross-reference: Table 2 · Revenue by product line", headings by
  name - and inserts the reference at the cursor (the palette keeps the
  cursor). Outside a paragraph or list item it says where to put it.
- Not yet: equations (`@eq:`), which need ids folio's `$$` blocks do
  not have.
- Print: references print as plain text in the text colour.

## Acceptance

- Unit: `tests/render/cross-ref-inline.test.ts`, `tests/engine/outline.test.ts`
  (slugs). e2e: `tests/e2e/cross-references.spec.ts`.
- First-contact eval: `evals/cross-references-first-contact.md`.
