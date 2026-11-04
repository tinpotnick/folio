---
name: chart-grouping-first-contact
feature: grouped chart queries - group/agg/limit (docs/specs/chart-rendering.md, "Grouped queries")
steps:
  - Start the demo host. Import `demo/data/calls-2026-03.db`, table
    `cdr`, Import.
  - Click a cell in the table, press **Chart it**, then click the
    chart to open its bar.
  - Set **Group by** to `hangup_cause`, **Aggregate** to `n=count`,
    **Type** to `pie` - watch the chart become two slices.
  - Then set **Group by** to `hangup_cause, destination_number`,
    **Aggregate** to `billed=sum(total_billed), n=count`, sort by
    `billed` desc, **Limit** `3`.
  - Switch to the Markdown source view.
expected:
  - The pie shows one slice per hangup cause (NORMAL_CLEARING,
    NO_ANSWER) with counts - no helper table was built by hand.
  - The two-key grouped chart renders, capped at 3 rows by the
    limit; the source shows `query: {group: [hangup_cause,
    destination_number], agg: {billed: sum(total_billed), n: count},
    sort: {by: billed, order: desc}, limit: 3}` and round-trips.
  - With a group set, the chart bar's **Columns** box is read-only
    (the output columns derive from the group keys and aggregates).
---
