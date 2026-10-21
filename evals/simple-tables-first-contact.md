---
name: simple-tables-first-contact
feature: simple tables and datasets (docs/specs/simple-tables.md)
steps:
  - As a Markdown user who edits README files for GitHub, insert a
    table into a document, fill in two rows, and open the Markdown
    source.
  - Paste a GitHub pipe table into the source and switch back to the
    document view.
  - Find out how to chart that table.
  - On the Q3 example's regional table, try to turn it into a plain
    table.
expected:
  - The inserted table is a standard `| a | b |` pipe table in the
    source, with no `:::` block.
  - The pasted table renders as a real table; its bar says "Table".
  - The bar's "Make it a dataset" (and its tooltip) explains the
    route to charts; after it, the bar says "Dataset · table-N".
  - Pressing "Convert to simple table" shows, in the bar, why it
    can't (growth is a formula; a chart uses it), so nothing is
    silently lost.
  - The pasted table's own spacing survives a view switch untouched;
    the inserted table lands where the caret was.
  - "Chart it" on the dataset (or searching "chart") makes a chart
    without writing a directive.
---
