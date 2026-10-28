---
name: chart-readout-first-contact
feature: chart readout - hover, tap and keyboard values (docs/specs/chart-readout.md)
steps:
  - In "Open example: Repay or invest?", find out exactly how much was invested in the month the 2023 rate rise hit (Figure 3), without opening the Markdown or the data.
  - Do the same using only the keyboard.
  - Print or export the document and check what the chart looks like on paper.
expected:
  - Pointing at the chart shows a guide and a panel with the month (as a date) and each series' value in pounds and pence; it follows the pointer and goes when the pointer leaves.
  - The keyboard route is findable (Tab to the chart, or Ctrl+K "read a chart's values") and the arrows step month by month; Esc puts it away.
  - Clicking the chart still opens its settings bar; printed/exported pages show no readout.
---
# First-contact eval: reading a chart's values

A reader wants the exact number behind a point on a chart.
