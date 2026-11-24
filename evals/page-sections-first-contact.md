---
name: page-sections-first-contact
feature: page sections, print header/footer (docs/specs/print.md, "Page sections")
steps:
  - Open an example, put the cursor mid-document, and search "insert page section" in Ctrl+K to add a page section.
  - Switch to the Markdown view and add `header: "Part Two"` and `orientation: landscape` to the new `::: page` block.
  - Back in the document view, notice the block is invisible; print (Ctrl+P) or Export as PDF.
  - In Document settings, set Orientation to Landscape and watch the `page.orientation` key appear in the source.
expected:
  - "Insert page section" is found by searching "page section"/"header"/"footer" in Ctrl+K and adds a `::: page {#sec-1}` block after the cursor's block in the Markdown source.
  - The block renders as nothing on screen; in print media it forces a new page, and pages from that point carry the section's header (and landscape size, via the named @page rule / the desktop export's per-section print).
  - Page numbering continues across the section ("Page 4 of 12"), and the document's first page still shows no running header.
  - Document settings' Orientation dropdown writes `page.orientation: landscape` into the style header; help topic "Printing and PDF" explains both paths.
---

# First-contact eval: page sections

A new user adds a mid-document page section with a header and
landscape orientation using only visible affordances, and sets the
document-wide orientation from Document settings.
