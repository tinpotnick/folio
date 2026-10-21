---
name: table-entry-first-contact
feature: table-keyboard
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations").
  - Click the q2 cell of the first table row; type a number.
  - Press Tab. Switch to Markdown view and back.
  - Click the q3 cell of the same row; type a number; press Tab.
  - Look at the growth column and the chart.
expected:
  - Clicking a cell focuses it; typing edits that cell only.
  - Typing never escapes the table via Tab (no toolbar focus).
  - The growth column recalculates for the edited row and the chart
    updates as soon as the cell commits.
  - The Markdown source contains the typed values; nothing typed is
    lost on view switches or re-renders.
  - In the browser, Tab/Enter move to the next cell and the caret
    follows; past the last row a new row appears. In the desktop
    app, Tab commits the cell; the user clicks the next cell.
---

# First-contact eval: table entry

An agent playing a new user must be able to fill a table row with
typed data, see formulas recalculate, and lose nothing on the
Markdown round-trip — on both the web and desktop hosts.
