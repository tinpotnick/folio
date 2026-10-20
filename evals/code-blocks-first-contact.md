---
name: code-blocks-first-contact
feature: code-blocks
steps:
  - Start the demo host. Without reading any documentation, add a
    code block to the document and type a few lines of Python into
    it, using only visible affordances (toolbar icons, tooltips,
    the command palette, the in-app help).
  - Make the block say it is Python, without switching to the
    Markdown view.
  - Change the same block to JavaScript, then to Plain text.
  - Click somewhere else in the document.
  - Switch to Markdown view, look at the fence, and switch back.
expected:
  - The code button (`</>`, tooltip mentions code) converts the
    caret's paragraph into a code block; typing and Enter add lines.
  - Clicking into the code block reveals a code header with a
    language picker; searching the palette for "language" or "code"
    finds "Change the code block language", which opens the same
    picker. The help document describes both.
  - Picking Python colors the code (keywords, strings, names);
    picking JavaScript recolors it; Plain text removes the colors.
    The text itself never changes.
  - Clicking elsewhere hides the header (no close button).
  - The Markdown view shows the fence tagged with the picked
    language (a bare fence for Plain text); the view round-trip
    preserves the code byte for byte.
---
