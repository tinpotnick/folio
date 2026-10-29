---
theme: technical
---

# Compute: Python on your data

A **compute block** is Python that runs on a dataset in this
document and returns new tables, which charts (and other compute
blocks) can read like any dataset. The tag is plain `python` — what
makes it run is the binding on the fence (`data=@budget
out=forecast`), so a Python snippet in a tutorial stays inert code,
exactly as on GitHub.

The script runs in a sealed sandbox — no network, no files — and
its outputs recalculate as you edit the data or the code. No run
button: it is a figure, like a chart.

::: table {#budget}
caption: "Launch budget"
columns:
  - {name: item, type: text}
  - {name: cost, type: number, unit: "£k", align: right}
data:
  - [Engineering, 30]
  - [Design, 12]
  - [Marketing, 8]
:::

## Totals

The dataset arrives as `budget`, a list of dicts keyed by column
name. The block returns one table (`out=totals`):

```python data=@budget out=totals
total = sum(r["cost"] for r in budget)
share = [{ "item": r["item"], "cost": r["cost"] } for r in budget]
return [{ "item": "Total", "cost": total }]
```

## Multi in, multi out

One block can read several datasets and return several tables,
matched to `out=` by position:

```python data=@budget,@rates out=forecast,warning
months = []
cost = sum(r["cost"] for r in budget)
rate = rates[0]["monthly_rate"]
for m in range(1, 7):
    months.append({ "month": m, "spend": round(cost / 6 * rate, 1) })
warn = [{ "level": "high" if cost > 40 else "fine" }]
return months, warn
```

::: table {#rates}
caption: "Rates"
columns:
  - {name: monthly_rate, type: number, align: right}
data:
  - [1]
:::

A chart can read a compute block's output — `@forecast`, a dataset
like any other:

::: chart {#spend-chart}
source: @forecast
query: {select: [month, spend]}
type: line
caption: "Spend by month (from Python)"
:::
