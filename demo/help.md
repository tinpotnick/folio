---
theme: corporate-report
style:
  body.font.family: "Source Serif 4"
  h1.font.size: 24pt
  h2.font.size: 18pt
  table.style: "booktabs"
---

# folio help

Everything in folio is one Markdown document: prose, typed tables,
and charts generated from them. This help page is itself a folio
document — written in the same renderer you are working with.

## Views and sections

- **Document view** is the rendered report. Click into any text and
  type; table formulas recalculate as you edit.
- Inline formats follow GitHub Markdown plus a few documented
  additions: **bold**, *italic*, `code`, ~~strikethrough~~, and
  ++underline++ (GitHub has no underline, so folio uses `++`).
- The block and format buttons (H1, H2, P, B, I, code) always show
  where you are: the button for the block or format at your caret
  lights up — in Document view and in Markdown view alike. On
  heading lines the inline buttons (B, I, code) switch off: a heading
  is already a complete format. In Markdown view the buttons also
  work on the source: H1 prefixes the line, B wraps the selection
  (or word) in `**`.
- **Markdown view** (toolbar toggle) shows the source with syntax
  highlighting. Switch back to Document to re-parse. If a parse
  error appears, fix the reported line — folio stays in source view
  until the Markdown is valid.
- The **☰** button (tooltip "Sections") toggles the outline
  sidebar. Click a section to jump straight to it.

## Opening and saving

- **Desktop app:** the Open button (folder icon) loads a .md file
  from disk; Save (arrow-down icon) writes the current document to
  a file you choose.
- **Web:** switch to Markdown view and copy the source — the plain
  Markdown text is the document.

## Tables and charts

- The insert group (three icons after the format buttons) holds the
  block builders: table, Mermaid diagram, and code block. The
  diagram button inserts a starter diagram; the code button converts
  the block you are in to a code block and back (in Markdown view it
  fences the paragraph you are in).
- Diagrams are Mermaid blocks: `::: mermaid {#id}` ... `:::` with
  the diagram source in between. They render as figures; edit the
  source in the Markdown view and switch back to re-render. Click a
  diagram to select it (it gets an outline) and press Backspace or
  Delete to remove it.
- Code blocks use GitHub-style fences (``` with an optional
  language). Enter adds lines inside a code block instead of
  splitting it.
- Click a cell and type. Press Tab (or Enter) to finish the cell:
  formulas and charts recalculate the moment you leave it, and the
  Markdown source always contains what you typed. In the browser,
  Tab/Enter also move the caret to the next cell and grow the table
  at the last row; in the desktop app they commit the cell — click
  the next cell to continue.
- Charts are not widgets — they are queries over a table. Edit the
  table and the figure updates on the next render. There is no run
  button anywhere in folio, and no execution state.

## Charts and the query language

A chart is a **query over a table**, written in the Markdown source.
The figure renders from the table's current data — edit the table
and the chart updates on the next render. The directive looks like
this:

```
::: chart {#growth-chart}
source: @regional-data
query: {select: [region, growth], sort: {by: growth, order: desc}}
type: bar
caption: "Quarter-on-quarter growth by region"
:::
```

- **source** points at a table by its anchor id (`@regional-data`).
- **query** has three parts, all optional except `select`:
  - `select: [column, column]` — the columns to plot. The first
    selected column labels the bars; the last is the value.
  - `filter: {column: q2, op: gt, value: 0}` — keep rows where the
    column passes. Operators: `eq`, `gt`, `lt`.
  - `sort: {by: growth, order: desc}` — sort by a column, `asc` or
    `desc`.
- **type** is `bar` (the rendered type; `line` and `scatter` are
  accepted by the parser but not yet drawn).
- **caption** is the figure caption.

Chart colors come from the document's style header:
`chart.palette: "muted"` or `"corporate"`.

### Table formulas

A formula column computes from other columns, cell by cell. The
grammar is column arithmetic: column names, numbers, `+ - * /`, and
parentheses — for example `expr: "(q3 - q2) / q2"` with
`format: percent`. Formulas recalculate the moment a cell they
depend on changes; formula cells are never editable by hand.

## Search

- Press **Ctrl+K** (or the magnifier button in the toolbar) to open
  the search box. Type words you know — "insert table", "regional
  summary", "keyboard shortcuts" — and Enter runs the top result.
  It searches commands, help topics, and the document's sections.

## Document settings

- The gear button (toolbar, or search "settings") opens the
  document settings: fonts, heading and body sizes, table style,
  chart palette, and page-break behavior. Everything it edits is
  the style header at the top of the Markdown source — the dialog
  is just a friendlier way to write the same YAML.
- **H1/H2 start a new page** applies when printing (and to PDF
  via the print dialog); a page break in folio is a style, never
  a character in your text.

## Keyboard shortcuts

::: table {#help-shortcuts}
caption: "Shortcuts"
columns:
  - {name: shortcut, type: text, width: 34}
  - {name: action, type: text}
data:
  - [?, Open this help]
  - [F1, Open this help]
  - [Ctrl+K, Search commands, help, and sections]
  - [Esc, Close the help window]
:::

## Getting help

The help window is always one press away: the **? Help** toolbar
button, or the **?** key when you are not typing.
