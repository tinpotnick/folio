# Views and sections

- **Document view** is the rendered report. Click into any text and
  type; table formulas recalculate as you edit.
- Inline formats follow GitHub Markdown plus a few documented
  additions: **bold**, *italic*, `code`, ~~strikethrough~~, and
  ++underline++ (GitHub has no underline, so folio uses `++`).
- The text style menu and the format buttons always show where you
  are: the style menu names the block at your caret ("Heading 2"),
  and the format at your caret lights up — in Document view and in
  Markdown view alike. On heading lines the inline buttons (B, I,
  code) switch off: a heading is already a complete format. In
  Markdown view they also work on the source: Heading 1 prefixes the
  line, B wraps the selection (or word) in `**`.
- **Markdown view** (toolbar toggle) shows the source with syntax
  highlighting. Switch back to Document to re-parse. If a parse
  error appears, fix the reported line — folio stays in source view
  until the Markdown is valid.
- The **sidebar** button at the far left (tooltip "Sections") toggles the outline
  sidebar. Click a section to jump straight to it; the section you
  are reading stays marked as you scroll.
