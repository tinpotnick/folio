---
theme: newsroom
style:
  table.rows.show: "24"
---

# Two-year sales report

This document is what an **import** looks like after it lands:
the table below is a snapshot of `demo/data/monthly-sales.csv`
(provenance in its `import:` line), with formula columns added on
top. The windowed view shows the head of each region's run; the
dataset browser browses all 72 rows.

::: table {#monthly-sales}
caption: "Monthly revenue by region (imported from monthly-sales.csv)"
import: "monthly-sales.csv"
columns:
  - {name: month, type: text}
  - {name: region, type: text}
  - {name: units, type: number, align: right}
  - {name: revenue, type: number, unit: "£k", align: right}
  - {name: growth, type: formula, align: right, expr: "self.row == 1 ? 0 : (revenue - self.prev.revenue) / self.prev.revenue", format: percent}
data:
  - [2024-01, North, 36, 41.3]
  - [2024-02, North, 35, 40.2]
  - [2024-03, North, 38, 43.3]
  - [2024-04, North, 38, 43.6]
  - [2024-05, North, 38, 43.3]
  - [2024-06, North, 38, 43.5]
  - [2024-07, North, 39, 44.5]
  - [2024-08, North, 37, 42.9]
  - [2024-09, North, 38, 44.2]
  - [2024-10, North, 38, 43.6]
  - [2024-11, North, 43, 49]
  - [2024-12, North, 44, 50.3]
  - [2025-01, North, 39, 44.9]
  - [2025-02, North, 40, 45.8]
  - [2025-03, North, 43, 49.9]
  - [2025-04, North, 44, 50.1]
  - [2025-05, North, 41, 47.3]
  - [2025-06, North, 42, 48.8]
  - [2025-07, North, 43, 50]
  - [2025-08, North, 42, 48.1]
  - [2025-09, North, 44, 50.9]
  - [2025-10, North, 44, 51.1]
  - [2025-11, North, 48, 55.6]
  - [2025-12, North, 48, 55.5]
  - [2024-01, South, 29, 30.8]
  - [2024-02, South, 28, 29.8]
  - [2024-03, South, 29, 31]
  - [2024-04, South, 29, 31.1]
  - [2024-05, South, 29, 31.1]
  - [2024-06, South, 29, 30.8]
  - [2024-07, South, 30, 31.3]
  - [2024-08, South, 30, 31.3]
  - [2024-09, South, 29, 31]
  - [2024-10, South, 30, 32]
  - [2024-11, South, 32, 34.1]
  - [2024-12, South, 33, 34.6]
  - [2025-01, South, 30, 32.1]
  - [2025-02, South, 30, 31.8]
  - [2025-03, South, 32, 34]
  - [2025-04, South, 32, 33.6]
  - [2025-05, South, 31, 32.4]
  - [2025-06, South, 29, 31.2]
  - [2025-07, South, 30, 31.7]
  - [2025-08, South, 30, 32]
  - [2025-09, South, 30, 31.7]
  - [2025-10, South, 30, 32.1]
  - [2025-11, South, 33, 35.2]
  - [2025-12, South, 34, 35.7]
  - [2024-01, Midlands, 23, 22.2]
  - [2024-02, Midlands, 23, 22.2]
  - [2024-03, Midlands, 24, 23.8]
  - [2024-04, Midlands, 24, 23.9]
  - [2024-05, Midlands, 24, 23.3]
  - [2024-06, Midlands, 25, 24.7]
  - [2024-07, Midlands, 25, 24.7]
  - [2024-08, Midlands, 26, 25.1]
  - [2024-09, Midlands, 25, 24.9]
  - [2024-10, Midlands, 27, 26.2]
  - [2024-11, Midlands, 29, 28.3]
  - [2024-12, Midlands, 30, 29.2]
  - [2025-01, Midlands, 29, 28.1]
  - [2025-02, Midlands, 29, 28]
  - [2025-03, Midlands, 30, 29.8]
  - [2025-04, Midlands, 31, 30.5]
  - [2025-05, Midlands, 31, 29.9]
  - [2025-06, Midlands, 31, 30.3]
  - [2025-07, Midlands, 31, 29.8]
  - [2025-08, Midlands, 31, 30]
  - [2025-09, Midlands, 32, 31.1]
  - [2025-10, Midlands, 32, 31.6]
  - [2025-11, Midlands, 36, 35.2]
  - [2025-12, Midlands, 38, 37.4]
:::

::: chart {#north-chart}
source: @monthly-sales
query: {select: [month, revenue], filter: "region == 'North'", sort: {by: month, order: asc}}
type: line
caption: "North region revenue by month"
:::

::: chart {#growth-chart}
source: @monthly-sales
query: {select: [month, growth], filter: "region == 'Midlands'", sort: {by: month, order: asc}}
type: line
caption: "Midlands month-on-month growth"
:::

## What the data says

Over the two years, the **Midlands** grew fastest - up **68.5%**
from £22.2k to £37.4k - despite starting from the smallest base.
**North** remains the largest region at £55.5k (up 34.4%), and
**South** grew 15.9% to £35.7k. The peak month was November 2025:
North alone booked £55.6k, the seasonality every region shows.

The `growth` column is computed row by row - `(revenue -
self.prev.revenue) / self.prev.revenue` - exactly the formula
language charts use for their filters; the first row of each
region seeds at zero. Try it live: open the dataset browser from
the table's status line and filter `revenue > 50`.
