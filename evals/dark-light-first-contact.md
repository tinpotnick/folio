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
    modals turn dark; the rendered document keeps its paper look.
  - The reload comes up dark with no flash of light first; the
    button now says "Switch to light mode".
  - The palette entry flips back to light; the moon/sun button
    always names the mode a press will go TO.
  - The tagline is gone from the header; hovering "folio" shows
    the tooltip naming folio a document-first workspace.
---
