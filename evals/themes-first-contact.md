---
name: themes-first-contact
feature: themes (docs/specs/themes.md)
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review"). Without reading
    any docs, try to make the document "look different" - change
    its overall style.
  - Pick a theme that looks nothing like the current one and
    apply it.
  - Switch to dark mode and look at the document.
  - Open the source and add `body.font.family: "Literata"` under
    a `style:` header line; return to the dialog.
expected:
  - Searching the palette for "theme", "look", "style" or "fonts"
    finds Change theme (or Document settings); the dialog opens on
    a grid of ten named theme cards, each previewing its own paper,
    title face and colors.
  - Applying a theme visibly changes fonts, heading treatment,
    table style, colors and chart colors at once - not just a
    font size.
  - In dark mode the document keeps its theme's character in that
    theme's own dark colors; charts stay readable without neon.
  - The dialog says "1 setting overrides the theme", and Reset to
    theme removes the override.
---
