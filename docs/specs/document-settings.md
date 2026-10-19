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

- **UI**: a gear button in the toolbar, a palette command
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
- **Controls** (style keys):
  - `body.font.family`, `h1.font.family` - font dropdown
    (Source Serif 4, Merriweather, Georgia, Arial, system-ui, plus
    the current value if custom).
  - `body.font.size` (17px), `h1.font.size` (28pt),
    `h2.font.size` (20pt) - free text, placeholder shows the
    default.
  - `table.style` - booktabs (default) or plain (full grid).
  - `chart.palette` - muted (default) or corporate.
  - `pagebreak.h1`, `pagebreak.h2` - "before" or unset. Maps to
    `break-before: page` (plus the legacy alias) on the heading,
    guarded by `:not(:first-child)` so the first heading never
    opens a blank page. Screen rendering ignores it; it applies in
    paged media (print). Markdown has no page-break token and
    folio adds none - a page break is a style, not content
    (non-negotiable: documents are semantic).

## Acceptance

- e2e: `tests/e2e/settings.spec.ts` (open/close, no-op Apply is
  byte-identical, font/size/table/palette/page-break writes reach
  the source AND the rendered shadow style, palette entry, Cancel
  discards, reopening shows applied values).
- Unit: `tests/render/theme.test.ts` (page-break rules emitted
  only for `before`, guarded by `:not(:first-child)`; plain table
  override).
- First-contact eval: `evals/document-settings-first-contact.md`.
