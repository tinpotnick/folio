---
name: jscad-follows-row-first-contact
feature: A model follows the row being edited (docs/specs/jscad-blocks.md, "Follows the row")
steps:
  - Open the "Parametric parts" example (palette: "Open example: Parametric parts").
  - Make the bracket model show the large bracket, without using the model's header.
  - Make the large bracket 150 mm long and see the model change.
expected:
  - Clicking any cell in the "large" row switches the model to the large bracket; the header's row picker reads "Row 3: large".
  - Typing 150 does not redraw on each key; pressing Tab (or Enter, or clicking away) redraws the model longer.
  - The fence reads `params=@bracket-sizes row=3`.
---
# First-contact eval: the model follows the row

A user tuning a parametric part edits its sizes table and expects the
model beside it to show what they are editing.
