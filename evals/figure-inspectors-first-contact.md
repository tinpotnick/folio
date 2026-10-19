---
name: figure-inspectors-first-contact
feature: figure-inspectors
steps:
  - Start the demo host. Click into a paragraph, then the equation
    button in the insert group (between diagram and code).
  - Click the rendered growth chart.
  - With the chart bar visible, switch type to line and put
    "q2 > 400" in the filter; press Enter.
  - Switch the chart's type to pie.
  - Click the chart's caption field and change it; press Enter.
  - Click a paragraph outside the chart, then click the chart
    again.
  - Switch to the technical example (palette: "Open example:
    technical"). Click the equation, edit its LaTeX in the bar
    that appears, press Enter. Then click the diagram and change
    its Mermaid source the same way.
  - Click a column heading in the sample's table.
expected:
  - The equation button inserts a typeset block right after the
    paragraph; the Markdown source shows the $$ fence.
  - The chart bar shows source, type, columns, filter, sort and
    caption; switching to line draws a polyline; the filter
    removes regions from the chart live; edits appear in the
    source, including an empty filter removing the key.
  - Switching to pie draws slices with percentage labels and the
    source shows "type: pie".
  - The bar hides the moment a click lands outside the chart and
    returns when the chart is clicked again - the same behavior
    as every other inspector, with no close button anywhere.
  - The equation and diagram bars show their block's source;
    editing re-renders in place and updates the source.
  - Clicking a column heading opens the table inspector on that
    column (the heading is not edited in place; the unit field is
    italic, and the unit itself is metadata, separate from the
    name).
---
