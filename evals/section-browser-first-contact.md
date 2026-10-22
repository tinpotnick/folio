---
name: section-browser-first-contact
feature: section-browser
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations").
  - Observe a section list on the left (or a visible toolbar control that reveals it).
  - Toggle the sidebar closed, then open it with the same control.
  - Click the "Regional summary" section.
  - Open the Q3 Sales Review example, open the sidebar, and BEFORE clicking anything scroll down by hand to the end of the page.
  - Click "Product mix", then "Next quarter", then scroll back up by hand.
expected:
  - The sidebar lists every heading in order.
  - Toggling hides and shows the sidebar without losing edits.
  - Clicking a section scrolls the document to that heading and it gains focus.
  - The heading lands fully visible just below the toolbar - not under it, not far down the page - even though charts above it draw late.
  - No box or focus ring is drawn around the heading.
  - The clicked section highlights as the active section, and the highlight follows the section being read while scrolling.
  - The highlight follows scrolling from the moment the sidebar opens, and reaches the last section at the end of the page.
  - After a jump the toolbar shows the heading's level (H2), and typing goes into the heading.
  - The sidebar looks like the rest of the app's chrome (neutral colours, no lone accent blue).
---
# First-contact eval: section browser

An agent playing a new user, using only visible affordances, must be
able to open and close the section browser and navigate to a section.
