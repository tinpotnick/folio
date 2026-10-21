---
theme: manuscript
---

# A Practice Journal

Six weeks of practice on two instruments, the exercises worked on,
and the goals for the next month. The charts read the log below, so
adding a week updates them.

## The log

::: table {#practice}
caption: "Minutes practised each week"
columns:
  - {name: week, type: text}
  - {name: violin, type: number, unit: "min", align: right}
  - {name: piano, type: number, unit: "min", align: right}
  - {name: theory, type: number, unit: "min", align: right}
  - {name: total, type: formula, unit: "min", align: right, expr: "violin + piano + theory"}
data:
  - [Wk 1, 120, 60, 20]
  - [Wk 2, 135, 75, 20]
  - [Wk 3, 90, 90, 30]
  - [Wk 4, 150, 80, 25]
  - [Wk 5, 160, 70, 30]
  - [Wk 6, 175, 95, 35]
:::

::: chart {#practice-stack}
source: @practice
query: {select: [week, violin, piano, theory]}
type: bar
stack: true
caption: "Where the time went, week by week"
:::

::: chart {#practice-trend}
source: @practice
query: {select: [week, violin, piano]}
type: line
caption: "Violin and piano minutes"
:::

Week 3 dipped for the violin while a piano exam took over; the total
recovered the week after.

## Exercises

Two short studies written for this month. Click a score to show its
**Play** button, and press it to hear the study.

A bowing study in D, string crossings in even quavers:

```abc
X:1
T:Crossing Study in D
M:4/4
L:1/8
Q:1/4=96
K:D
DFAF dAFA | EGBG eBGB | FAdA fdAd | e2 c2 d4 |
dAFA dAFA | cAEA cAEA | BGDG BGDG | A2 E2 D4 |]
```

An arpeggio waltz for the piano's right hand:

```abc
X:2
T:Arpeggio Waltz
M:3/4
L:1/8
Q:1/4=120
K:C
CEGc GE | DFAd AF | EGBe BG | c4 G2 |
ceg2 ec | Bdf2 dB | Acea ec | c6 |]
```

## Goals for next month

1. Violin
   - Hold three-octave scales at 80 bpm.
   - Learn the first page of the Bach double.
2. Piano
   - Hands together on the arpeggio waltz at 120.
3. Theory
   - Finish the chapter on secondary dominants.
