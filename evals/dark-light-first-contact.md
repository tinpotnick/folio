---
name: dark-light-first-contact
feature: dark/light mode (docs/specs/dark-light-mode.md)
steps:
  - Start the demo host (system in light mode). Press the moon
    button beside the ? button.
  - Reload the page.
  - Press it again; open the command palette and run "Toggle dark
    mode".
  - Hover the "folio" word in the header.
expected:
  - The toolbar, section browser, Markdown source view, and
    modals turn a calm neutral graphite (no blue cast); every
    toolbar button, including ?, stays legible. The document page
    turns dark in its THEME's own dark colors, with its margins,
    fonts, table style and calm, readable chart colors intact.
  - The reload comes up dark with no flash of light first; the
    button now says "Switch to light mode".
  - The palette entry flips back to light; the moon/sun button
    always names the mode a press will go TO.
  - The tagline is gone from the header; hovering "folio" shows
    the tooltip naming folio a document-first workspace.
---
