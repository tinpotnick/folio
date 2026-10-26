# Document settings

## Status: accepted (2026-10-18)

## Decision

A settings dialog with typed controls over the frontmatter style
keys (font dropdowns, sizes, table style, chart palette, page
breaks) - the closed theme schema already enumerates the keys and
their value spaces, so the dialog is generated from that schema.
The YAML header stays the source of truth: the dialog writes
through the same parse/serialize pipeline as editing the header by
hand, never a second representation.

## Contract

- **UI**: a sliders button in the toolbar (not a rayed gear, which
  read as a sun beside the dark-mode moon), a palette command
  ("Document settings"), and `<dialog id="settings-modal">` with a
  form of typed controls. Cancel/Close/Esc discard; Apply writes.
- **Values**: "default" and empty fields REMOVE the key so the
  theme default applies. Existing key ORDER is preserved (the
  dialog must not churn the user's YAML); keys the dialog does not
  know about pass through untouched; new keys append.
- **Apply**: parse the current Markdown (from the document view's
  model or the source editor), replace the style pairs, serialize,
  reload the component, refresh the source editor. The theme
  re-renders immediately; the caret is not preserved across an
  Apply (the document reloads).
- **Theme picker** (first): one card per shipped theme, previewing
  its paper, title face and palette in the current mode; writes the
  `theme:` line. See docs/specs/themes.md.
- **Overrides** (below the picker): each "Theme default (...)"
  option and size placeholder names the SELECTED theme's value.
  Each field that overrides the theme is marked (an accent edge), a
  note counts them, and **Reset to
  theme** clears every override field.
- **Controls** (style keys):
  - `body.font.family` ("Body font"), `h1.font.family` ("Title (H1)
    font"): a dropdown of the bundled faces (ADR-0017), plus the
    current value if it is custom.
  - `body.font.size`, `h1.font.size`, `h2.font.size`,
    `h3.font.size`: free text; the placeholder shows the theme's
    value.
  - `table.style`: booktabs, plain, striped, minimal, banded, or
    ledger (docs/specs/themes.md).
  - `chart.palette`: muted, corporate, ink, warm, sepia, vivid,
    news, jewel, mono, or swiss.
  - `pagebreak.h1`, `pagebreak.h2` - "before" or unset. Maps to
    `break-before: page` (plus the legacy alias) on the heading,
    guarded by `:not(:first-child)` so the first heading never
    opens a blank page. Screen rendering ignores it; it applies in
    paged media (print). Markdown has no page-break token and
    folio adds none - a page break is a style, not content
    (non-negotiable: documents are semantic).
  - `citation.style`: author-date (default) or numeric
    (docs/specs/citations.md).
  - `page.numbers`, `page.header` - unset (on) or "off": "Page n of
    N" and the running title on printed and exported pages
    (print.md, ADR-0027).

## Acceptance

- e2e: `tests/e2e/settings.spec.ts` (open/close, no-op Apply is
  byte-identical, font/size/table/palette/page-break writes reach
  the source AND the rendered shadow style, palette entry, Cancel
  discards, reopening shows applied values).
- Unit: `tests/render/theme.test.ts` (page-break rules emitted
  only for `before`, guarded by `:not(:first-child)`; plain table
  override).
- First-contact eval: `evals/document-settings-first-contact.md`.
