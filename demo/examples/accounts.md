---
theme: corporate-report
style:
  table.style: "booktabs"
---

# Half-year management accounts

Revenue grew in every region except one: the charts must be able
to show a decline when there is one.

::: table {#pl}
caption: "Operating summary by region (GBP thousands)"
columns:
  - {name: region, type: text, width: 30}
  - {name: h1, type: number, unit: "£k", align: right}
  - {name: h2, type: number, unit: "£k", align: right}
  - {name: change, type: formula, expr: "(h2 - h1) / h1", unit: "%", format: percent, align: right}
data:
  - [North, 412, 501]
  - [South, 388, 394]
  - [East, 301, 255]
:::

::: chart {#pl-chart}
source: @pl
query: {select: [region, change], sort: {by: change, order: desc}}
type: bar
caption: "Half-on-half change by region"
:::

East declined by 15.3% — the bar hangs below the zero line.

::: table {#cashflow}
caption: "Cash by month (GBP thousands)"
columns:
  - {name: month, type: text, width: 30}
  - {name: inflow, type: number, unit: "£k", align: right}
  - {name: balance, type: formula, expr: "inflow + (self.row == 1 ? 0 : self.prev.balance)", unit: "£k", align: right}
data:
  - [Apr, 120]
  - [May, -40]
  - [Jun, 95]
:::

::: chart {#cash-chart}
source: @cashflow
query: {select: [month, inflow]}
type: bar
caption: "Monthly cash movement"
:::

::: table {#targets}
caption: "Full-year targets (GBP thousands)"
columns:
  - {name: year, type: text}
  - {name: target, type: number, unit: "£k", align: right}
data:
  - [2026, 2400]
:::

::: table {#progress}
caption: "Progress against the year target"
columns:
  - {name: month, type: text, width: 30}
  - {name: balance, type: number, unit: "£k", align: right}
  - {name: pct, type: formula, expr: "balance / @targets.prev.target", format: percent, align: right}
data:
  - [Apr, 120]
  - [May, 80]
  - [Jun, 175]
:::

June closes at 7.3% of the full-year target, read straight from
the targets table's last row (`@targets.prev.target`).
