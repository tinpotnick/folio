---
theme: corporate-report
style:
  h1.font.family: "Merriweather"
  h1.font.size: 28pt
  h2.font.size: 20pt
  body.font.family: "Source Serif 4"
  table.style: "booktabs"
  chart.palette: "muted"
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

## Cumulative view

Running totals and cross-table lookups - the same document, more
machinery.

::: table {#cumulative}
caption: "Cumulative revenue by month (GBP thousands)"
columns:
  - {name: month, type: text, width: 30}
  - {name: revenue, type: number, unit: "£k", align: right}
  - {name: total, type: formula, unit: "£k", align: right, expr: "revenue + (self.row == 1 ? 0 : self.prev.total)"}
data:
  - [Jul, 182]
  - [Aug, 205]
  - [Sep, 241]
:::

The running total adds each month's revenue to the row above
(`self.prev.total`).

::: table {#budget}
caption: "Quarterly budget (GBP thousands)"
columns:
  - {name: quarter, type: text}
  - {name: target, type: number, unit: "£k", align: right}
data:
  - [Q3, 600]
:::

::: table {#variance}
caption: "Month variance against budget (GBP thousands)"
columns:
  - {name: month, type: text, width: 30}
  - {name: revenue, type: number, unit: "£k", align: right}
  - {name: vs_budget, type: formula, unit: "£k", align: right, expr: "revenue - @budget.prev.target / 3"}
data:
  - [Jul, 182]
  - [Aug, 205]
  - [Sep, 241]
:::

Each month is compared with a third of the quarter's target,
read from the budget table's last row (`@budget.prev.target`) -
tables reference tables by name, like charts do.

::: chart {#cumulative-chart}
source: @cumulative
query: {select: [month, total], filter: "revenue > 190"}
type: bar
caption: "Cumulative revenue, months with revenue above 190"
:::

*Figure 2* filters with a Jexl expression - the same language as
table formulas.

::: image {#ops-cover}
src: data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0ODAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iNDgwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iIzFmMjMyOCIvPjxyZWN0IHg9IjE4IiB5PSIxOCIgd2lkdGg9IjQ0NCIgaGVpZ2h0PSIxMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzRjNmVmNSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iMjQwIiB5PSI3NiIgZm9udC1zaXplPSIzNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZmZmZiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIj5RMyBGaWVsZCBPcGVyYXRpb25zPC90ZXh0Pjx0ZXh0IHg9IjI0MCIgeT0iMTEyIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOGI5NDllIiBmb250LWZhbWlseT0iR2VvcmdpYSwgc2VyaWYiPnJldmlldyBkZWNrIGNvdmVyLCBPY3RvYmVyPC90ZXh0Pjwvc3ZnPg==
alt: "Q3 Field Operations cover slide"
caption: "The review deck cover - a folio image block (SVG, embedded as a data URI)"
:::

## More examples

Every genre ships with the app - each link opens that document
in place:

- [A pure-prose poem](demo/examples/poem.md) - typography only,
  no data at all.
- [Management accounts](demo/examples/accounts.md) - tables,
  formulas, and a chart that shows a decline.
- [A technical paper](demo/examples/technical.md) - equations,
  code, and diagrams.
- [Signals and spectra](demo/examples/signal-processing.md) - a
  64-sample signal, its FFT spectrum, and a low-pass filter, every
  number a live formula.
- [An imported-data report](demo/examples/report.md) - a 72-row
  import with running formulas and line charts.
- [A music document](demo/examples/music.md) - Strudel patterns
  that play in the page.
