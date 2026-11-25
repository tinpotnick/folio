---
style:
  page.footer: "Internal draft"
---

# Field season report

This report shows **page sections**: `::: page` blocks that change
the printed header, footer and even the page orientation partway
through. Print it (Ctrl+P) or Export as PDF and watch the furniture
change from section to section - page numbers keep counting, they
never restart. On screen the blocks are invisible; in the Markdown
view you can see and edit them.

## Method

Measurements were taken at dawn and dusk across three sites.

::: page {#sec-results}
header: "Field season report - Results"
footer: "Results - internal draft"
orientation: landscape
:::

## Results

The wide table below is why this section is landscape.

| Site  | Dawn readings | Dusk readings | Mean temp | Notes            |
| ----- | ------------: | ------------: | --------: | ---------------- |
| North |           412 |           388 |      11.2 | wet morning      |
| South |           501 |           394 |      12.8 |                  |
| East  |           377 |           410 |      10.9 | sensor replaced  |
| West  |           455 |           402 |      13.1 |                  |

::: page {#sec-appendix}
header: "Field season report - Appendix"
footer: "End of report"
numbers: on
orientation: portrait
:::

## Appendix

Raw observation logs follow. The header and footer above change at
each `::: page` block; keys left out carry over from the section
before.
