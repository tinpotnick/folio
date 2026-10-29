---
theme: technical
---

# Coffee forecast

*A corner café's daily sales, and the question every small shop asks:
how much will we sell next month? The answer needs a trend, not a
formula - so this document runs **Python** on its own tables. Change
the sales data and every forecast, band and chart follows.*

[[_TOC_]]

## The data

Two weeks of daily takings, kept as a **dataset** in this document.
Edit any number - the forecast below recomputes.

::: table {#takings}
caption: "Daily takings (£)"
columns:
  - {name: day, type: number, align: right}
  - {name: takings, type: number, unit: "£", align: right}
data:
  - [1, 412]
  - [2, 438]
  - [3, 401]
  - [4, 455]
  - [5, 462]
  - [6, 447]
  - [7, 431]
  - [8, 465]
  - [9, 481]
  - [10, 470]
  - [11, 496]
  - [12, 508]
  - [13, 522]
  - [14, 531]
:::

## The forecast

A linear trend fit by least squares - the kind of maths a formula
column cannot express, and Python can. The script reads `takings`
(the dataset above) and returns two tables (`out=fit,band`): the
trend line, and a band around it.

```python data=@takings out=fit,band
n = len(takings)
xs = [r["day"] for r in takings]
ys = [r["takings"] for r in takings]
mx = sum(xs) / n
my = sum(ys) / n
slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
intercept = my - slope * mx
fit = [{"day": x, "trend": round(intercept + slope * x, 1)} for x in xs]
band = [{"day": x, "high": round(intercept + slope * x + 40, 1),
         "low": round(intercept + slope * x - 40, 1)} for x in xs]
return fit, band
```

The trend, drawn as a chart over the Python's output:

::: chart {#trend-chart}
source: @fit
query: {select: [day, trend]}
type: line
caption: "The fitted trend (computed by Python)"
:::

## Next month

The same fit projected forward - a fortnight past the data, day by
day. This is the table a shop owner would act on: staffing, orders,
and what "a good day" means.

```python data=@takings out=projection
n = len(takings)
xs = [r["day"] for r in takings]
ys = [r["takings"] for r in takings]
mx = sum(xs) / n
my = sum(ys) / n
slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
intercept = my - slope * mx
return [{"day": 15 + i, "takings": round(intercept + slope * (15 + i), 1)}
        for i in range(14)]
```

::: chart {#projection-chart}
source: @projection
query: {select: [day, takings]}
type: bar
caption: "The next fortnight, projected"
:::

## What this document shows

- The tag is plain `python` - on GitHub these blocks are ordinary
  code. What makes them run is the binding (`data=@takings
  out=fit,band`), so a Python snippet in a tutorial stays inert.
- No run button anywhere: the outputs are figures, like charts. They
  recompute a moment after you edit the data or the code.
- The scripts run sealed off - no network, no files - and their
  outputs are datasets like any other, which is why the charts above
  can query them.
