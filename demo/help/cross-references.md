# Numbered tables, figures and cross-references

- Every captioned table and figure is numbered in order: "Table 2.
  Revenue by product line", "Figure 1. Revenue by month and region".
- To refer to one in the text, put the cursor where it belongs and
  choose **+ Insert › Cross-reference** (or search "reference" with
  Ctrl+K), then pick it. The text reads "Table 2"; click it to go
  there. Headings can be referred to the same way, by name.
- Numbers and references keep themselves right as you add, move or
  delete tables and figures.
- In the Markdown view a reference is `@tbl:product-mix`,
  `@fig:region-trend` or `@sec:against-target` (Pandoc's and Quarto's
  syntax): the table's or chart's id, or the heading's name in lower
  case with hyphens.
