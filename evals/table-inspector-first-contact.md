---
name: table-inspector-first-contact
feature: table-inspector
steps:
  - Start the demo host with the sample document.
  - Click the growth column's formula cell (any row).
  - With the bar visible, change the formula from
    "(q3 - q2) / q2" to "q3 - q2" and press Enter.
  - Select the q2 column in the bar and change its unit from
    £k to £m; press Enter.
  - Click into a paragraph.
expected:
  - The bar appears above the table the moment a cell is clicked,
    showing the column's name, type, unit, format, and - for
    formula columns - the ƒx expression.
  - Editing the expression recalculates the whole column live and
    the Markdown source shows the new expression.
  - The unit appears in the column header ("q2 (£m)") without
    hovering, and the source reflects it.
  - Clicking away from the table hides the bar; Esc and clicking
    other tables never corrupt the document.
---
