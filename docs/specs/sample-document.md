---
theme: corporate-report
---

# Q3 Field Operations Review

Revenue recovered after the service outage, with the North region
leading for the second consecutive quarter.

## Regional summary

Numbers are pulled live from the table below; the prose stays static.

::: table {#regional-data}
caption: "Q3 revenue by region (GBP thousands)"
columns:
  - {name: region, type: text, width: 30}
  - {name: q2, type: number, unit: "£k", align: right}
  - {name: q3, type: number, unit: "£k", align: right}
  - {name: growth, type: formula, expr: "(q3 - q2) / q2", format: percent}
data:
  - [North, 412, 501]
  - [South, 388, 394]
  - [Midlands, 301, 355]
:::

Growth was strongest in the **Midlands** at 17.9%.

::: chart {#growth-chart}
source: @regional-data
query: {select: [region, growth], sort: {by: growth, order: desc}}
type: bar
caption: "Quarter-on-quarter growth by region"
:::

*Figure 1* is generated from the table; if the table edits, the
figure updates on next render. No run button. No execution state.
