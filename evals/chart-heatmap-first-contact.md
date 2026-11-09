---
name: chart-heatmap-first-contact
feature: chart-heatmap
steps:
  - Open the demo host on the subreddit-meta example (palette: "Open
    example: subreddit-meta").
  - Scroll to the "When people post" section; the activity heatmap
    shows hour x day-of-week cells.
  - Hover a busy cell; read its tooltip.
  - Click the heatmap; in its bar, click the heatmap icon in the
    Type row (a 3x3 grid), then the bar icon, then the heatmap icon
    again.
  - Open the field-operations example, click its growth chart, set
    Columns to "region, q2, growth" in the bar, then click the
    heatmap type icon.
  - With the caret in a table, open the palette (Ctrl+K), search
    "insert a heatmap", and run it.
expected:
  - The activity heatmap draws 24 x 7 cells; busy evenings and
    weekends are the darkest (accent) cells; each cell's tooltip
    reads "hour, dow: count"; a small legend names the value column
    with its min and max; the axis titles name hour and day.
  - Clicking the type icons redraws the chart in place and the
    Markdown source follows ("type: heatmap" / "type: bar"); the
    active icon is marked.
  - The field-operations chart becomes a 3-cell heatmap (one cell
    per region), and the source shows type: heatmap.
  - The palette inserts a heatmap chart of the dataset at the caret,
    grouped by its first two text columns with a count, and the
    source shows the grouped query and type: heatmap.
  - Editing a table cell re-colors the heatmap live (no run
    button), and the source always contains the current query.
---
