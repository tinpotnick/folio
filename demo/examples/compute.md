---
theme: technical
---

# Coffee forecast

*A corner café's daily sales, and the question every small shop asks:
how much will we sell next month? The answer needs a trend, not a
formula - so this document runs **Python** on its own tables. Change
the sales data and every forecast, figure and chart follows.*

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

A straight-line trend, fitted by least squares - maths a formula column
cannot express, and Python can. The script reads `takings` (the dataset
above) and **publishes two variables**, named on its first line
(`out=fit,slope`):

- `fit`, the trend line - a table, so it becomes the dataset `@fit`;
- `slope`, how much the takings grow each day - a single number, so it
  becomes the value `@slope`.

```python data=@takings out=fit,slope
xs = takings.col("day")
ys = takings.col("takings")
n = len(xs)
mx = sum(xs) / n
my = sum(ys) / n
slope = round(sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs), 2)
intercept = my - slope * mx
fit = [{"day": x, "trend": round(intercept + slope * x, 1)} for x in xs]
```

::: table {#fit}
computed: python
columns:
  - {name: day, type: number}
  - {name: trend, type: number}
data:
  - [1, 410]
  - [2, 418.6]
  - [3, 427.1]
  - [4, 435.7]
  - [5, 444.2]
  - [6, 452.8]
  - [7, 461.4]
  - [8, 469.9]
  - [9, 478.5]
  - [10, 487]
  - [11, 495.6]
  - [12, 504.2]
  - [13, 512.7]
  - [14, 521.3]
:::

::: value {#slope}
computed: python
value: 8.56
:::

A chart draws `@fit` like any dataset:

::: chart {#trend-chart}
source: @fit
query: {select: [day, trend]}
type: line
caption: "The fitted trend (computed by Python)"
:::

And a formula reads `@slope` like a cell - here, what the trend adds
over a week and over four:

::: table {#growth}
caption: "Growth at the current trend (£)"
columns:
  - {name: period, type: text}
  - {name: days, type: number, align: right}
  - {name: growth, type: formula, unit: "£", expr: "(@slope * days) | round(2)", format: currency}
data:
  - ["A week", 7, ""]
  - ["Four weeks", 28, ""]
:::

## Next fortnight

A second script builds on the first: it reads the first one's outputs,
`@fit` and `@slope`, and carries the trend forward a fortnight - the
table a shop owner would act on: staffing, orders, and what "a good
day" means.

```python data=@fit,@slope out=projection
last = fit[-1]
projection = [
    {"day": last["day"] + i, "takings": round(last["trend"] + slope * i, 1)}
    for i in range(1, 15)
]
```

::: table {#projection}
computed: python
columns:
  - {name: day, type: number}
  - {name: takings, type: number}
data:
  - [15, 529.9]
  - [16, 538.4]
  - [17, 547]
  - [18, 555.5]
  - [19, 564.1]
  - [20, 572.7]
  - [21, 581.2]
  - [22, 589.8]
  - [23, 598.3]
  - [24, 606.9]
  - [25, 615.5]
  - [26, 624]
  - [27, 632.6]
  - [28, 641.1]
:::

::: chart {#projection-chart}
source: @projection
query: {select: [day, takings]}
type: bar
caption: "The next fortnight, projected"
:::

## What this document shows

- **Code stays code.** Each script shows as itself; the line under it
  says what it published (`→ @fit (14 rows) · @slope = …`). Click a
  dataset there to browse it.
- **Data in:** `data=@takings` hands the script that table, as a list
  of rows - `takings[2]["takings"]` is a cell, `takings.col("day")` a
  column.
- **Data out:** the variables named in `out=` become `@names`, exactly
  like the document's own tables: charts, formulas and other scripts
  use them. Tick variables in the block's header to publish them.
- No run button anywhere: a script runs again a moment after you edit
  its code, or when a table it reads changes.
- The tag is plain `python` - on GitHub these blocks are ordinary code.
  What makes them run is `data=` / `out=`, so a Python snippet in a
  tutorial stays inert.
- The scripts run sealed off - no network, no files. Their outputs are
  stored in the document, so it opens with every figure in place, even
  before Python has loaded.
