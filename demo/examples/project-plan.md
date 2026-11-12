---
theme: ledger
---

# Sprint plan: folio's own next week

*A plan is a table: tasks with a **status chip** (a select column -
click a cell for the dropdown), target dates with a **calendar
picker** (click a cell), and effort with a **totals row**. The charts
below share the table, so click a status bar in one and the others
filter to it (the chip above each chart clears).*

::: table {#plan}
caption: "Sprint 42 plan"
columns:
  - {name: task, type: text}
  - {name: status, type: select, options: [todo, doing, done]}
  - {name: owner, type: select, options: [Nick, Sam, Ada]}
  - {name: target, type: date, align: right}
  - {name: effort, type: number, unit: "d", align: right}
data:
  - ["Chip rendering in tables", doing, Nick, 2026-11-11, 2]
  - ["Cross-filter between charts", todo, Ada, 2026-11-13, 3]
  - ["Date picker on date columns", todo, Sam, 2026-11-12, 1]
  - ["Motion figures in slides", done, Nick, 2026-11-10, 2]
totals:
  - {col: effort, expr: "self.col.effort | sum()"}
:::

::: chart {#by-status}
source: @plan
query: {group: [status], agg: {tasks: count, effort: sum(effort)}, sort: {by: status, order: asc}}
type: bar
caption: "Tasks and effort by status - click a bar to filter the others"
:::

::: chart {#by-owner}
source: @plan
query: {group: [owner], agg: {effort: sum(effort)}, sort: {by: effort, order: desc}}
type: bar
caption: "Effort by owner"
:::
