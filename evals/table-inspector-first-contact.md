---
name: table-inspector-first-contact
feature: table-inspector
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review").
  - Click the growth column's formula cell (any row).
  - With the bar visible, change the formula from
    "(q3 - q2) / q2" to "q3 - q2" and press Enter.
  - Select the q2 column in the bar and change its unit from
    £k to £m; press Enter.
  - Click the region column's header name, type "area" over it,
    and press Enter.
  - Click into a paragraph.
  - Click a q2 cell again; in the bar, click "Open dataset" and
    close the browser with Esc.
expected:
  - The bar appears above the table the moment a cell is clicked,
    and the clicked column lights up in the table (accent ring on
    its header, tinted cells) while the bar is open. The bar's rows
    are scoped: row 1 is table-level in a fixed order on one line
    (kind, "Open dataset", "Convert to table", Rows, Chart it — Rows
    and Chart it wrap together if the page is narrow, so Chart it is
    never alone); the caption takes the next full-width line; then
    the column editor —
    one group box with the column picker and the formatting options
    (visible, type, unit, format), its tooltip naming the column,
    and directly under it the always-present full-width ƒx row with
    a large textarea (disabled until the column's type is formula,
    then enabled and seeded with 0).
  - Editing the expression recalculates the whole column live and
    the Markdown source shows the new expression.
  - The "Open dataset" button opens the full-window dataset browser
    for the table; Esc closes it back onto the table.
  - The unit appears in the column header ("q2 (£m)") without
    hovering, in italic, and the source reflects it. The unit is
    read-only: clicking the header never lets you type into it.
  - Typing over the header's name renames the column in place:
    the header shows "area", the Markdown source shows
    "{name: area", and charts selecting the old name follow it
    ("select: [area, growth]").
  - Clicking away from the table hides the bar; Esc and clicking
    other tables never corrupt the document.
---
