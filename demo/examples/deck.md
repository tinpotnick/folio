---
theme: deck
---

# Quarterly Review Deck

This document is also a slideshow: press the play button in the
toolbar (or Ctrl+K, "Play slideshow"). Each H2 below is one slide;
this preamble under the H1 is the deck's front matter - instructions
for the presenter, never a slide. Arrow keys advance, Esc stops.

## Revenue by region

- North led the quarter at 501k
- Midlands grew fastest at 17.9%
- South was flat; see the table on the next slide

> Speaker note: open with the growth story, not the absolute numbers.

## Regional detail

::: table {#deck-regional}
caption: "Q3 revenue by region (GBP thousands)"
columns:
  - {name: region, type: text}
  - {name: q2, type: number, unit: "£k"}
  - {name: q3, type: number, unit: "£k"}
  - {name: growth, type: formula, expr: "(q3 - q2) / q2", format: percent}
data:
  - [North, 412, 501]
  - [South, 388, 394]
  - [Midlands, 301, 355]
:::

## Growth chart

::: chart {#deck-growth}
source: @deck-regional
type: bar
x: region
y: growth
caption: "Quarter-on-quarter growth by region"
:::

## Closing

Questions.

> Deck-level reminder: export as PDF while playing for the 16:9 handout.
