---
name: undo-redo-first-contact
feature: undo/redo (docs/specs/undo-redo.md)
steps:
  - Start the demo host. Click into the intro paragraph and type
    a short phrase.
  - Press Ctrl+Z; then Ctrl+Shift+Z.
  - Insert a table with the toolbar button (focus is now on the
    button), then press Ctrl+Z without clicking back into the
    document.
  - Click a table cell, replace its value, press Tab, then Ctrl+Z.
  - Edit a figure's caption through its inspector bar, then Ctrl+Z.
  - Click the sample's image once and press Backspace, then Ctrl+Z.
  - Open the poem example from the palette and press Ctrl+Z.
expected:
  - The typed phrase disappears as one step and returns with redo.
  - The inserted table is removed by Ctrl+Z even with focus on the
    toolbar button, and returns with Ctrl+Y.
  - The cell edit reverts; the caption edit reverts; the removed
    image returns.
  - The undo button greyed out on the fresh document, and Ctrl+Z
    does nothing there.
  - Inspectors' own inputs still undo per-field with native
    Ctrl+Z while focused.
---
