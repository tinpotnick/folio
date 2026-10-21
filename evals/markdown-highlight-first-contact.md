---
name: markdown-highlight-first-contact
feature: markdown-highlighting
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review").
  - Switch to the Markdown view using the visible toolbar toggle.
  - Observe the source: frontmatter, headings, bold/italic/code and
    table directives must be visually distinguished by color, with a
    line-number gutter on the left.
  - Type an edit anywhere; the coloring must update as you type and
    the caret must sit exactly on the colored text (no misalignment).
  - Switch back to Document view; the edit must be parsed in.
expected:
  - The source view looks like a code editor, not a plain textarea.
  - Highlighting is live while typing; text remains plain editable text.
  - Round-trip into Document view works after an edit in the source view.
---
# First-contact eval: highlighted Markdown source

An agent playing a new user, using only visible affordances, must see
a code-editor-style colored Markdown source that stays editable.
