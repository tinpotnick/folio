---
name: section-browser-first-contact
feature: section-browser
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations").
  - Observe a section list on the left (or a visible toolbar control that reveals it).
  - Toggle the sidebar closed, then open it with the same control.
  - Click the "Regional summary" section.
expected:
  - The sidebar lists every heading in order.
  - Toggling hides and shows the sidebar without losing edits.
  - Clicking a section scrolls the document to that heading and it gains focus.
  - The clicked section highlights as the active section while scrolling.
---
# First-contact eval: section browser

An agent playing a new user, using only visible affordances, must be
able to open and close the section browser and navigate to a section.
