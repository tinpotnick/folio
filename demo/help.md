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

- The insert group (six icons after the format buttons) holds the
  block builders: table, Mermaid diagram, image, equation,
  Strudel music, and code block. The
  diagram button inserts a starter diagram; the equation button
  inserts a typeset `$$` block; the music button inserts a
  playable Strudel pattern; the code button converts the block
  you are in to a code block and back (in Markdown view it fences
  the paragraph you are in).
- Diagrams are Mermaid blocks: `::: mermaid {#id}` ... `:::` with
  the diagram source in between. They render as figures; edit the
  source in the Markdown view and switch back to re-render. Click a
  diagram to select it (it gets an outline) and press Backspace or
  Delete to remove it. Clicking a diagram, chart, or equation also
  opens its **inspector bar** - the Mermaid source, the chart's
  source/type/filter/sort/caption, or the LaTeX - editable in
  place, so you rarely need to drop to the Markdown view.
- Headings come in three toolbar levels, H1-H3; H3's size is a
  document setting alongside H1 and H2.
- Code blocks use GitHub-style fences (``` with an optional
  language). Enter adds lines inside a code block instead of
  splitting it. Click into a code block to reveal its **code
  header**: the **language picker** (Python, JavaScript,
  TypeScript, Rust, Go, SQL, Shell, JSON, YAML, and more - or
  Plain text) sets the fence's language, and the code is
  **syntax-highlighted** in that language. The header follows
  you down a long block; click outside (or press Esc) to close
  it. The palette's "Change the code block language" opens the
  picker for the block you are in. Backspace in an empty code
  block removes it.
- **Strudel** is the one language that plays: pick "Strudel
  (music)" in the language picker - or tag a fence `strudel` -
  and the code header gains **▶ Play** and **■ Stop**. Edit the
  pattern right in the block like any code. While it plays, the
  notes and pattern pieces sounding right now **light up** in
  the source and fade as they end. Edit while it plays and Play
  becomes **▶ Update** - press it to hear the change. A pattern
  like `note("c a f e")` loops as synthesized sound; see
  [strudel.cc](https://strudel.cc) for the language. Playback is
  offline - nothing is downloaded. Melodic sounds are synthesized,
  and folio ships its own **drum kit** under the usual names:
  `bd` kick, `sd` snare, `hh` closed hat, `oh` open hat, `cp`
  clap, `rim`, `lt` `mt` `ht` toms, `cr` crash, `rd` ride, `cb`
  cowbell - e.g. `s("bd sd [hh hh] sd")`. Add `:1` (`bd:1`) for
  an alternative sound. Examples copied from strudel.cc that pick
  an online sample bank - `.bank("RolandTR808")`, pianos, other
  instruments - stay silent here (the header shows no error, but
  those sounds are not in folio's offline kit); drop the `.bank(...)`
  to use folio's drums.
- **Themes**: the document settings dialog (gear icon) has a
  Theme select - default, corporate-report, technical, editorial.
  It writes the `theme:` line at the top of the source; any
  individual style setting still overrides the theme, key by key.
- **Links** are standard inline Markdown: `[label](url)` in a
  paragraph. Clicking a link follows it - a `.md` path opens
  that document in place (the sample's "More examples" section
  links all the shipped examples); anything with a protocol
  opens in a new tab. To create or edit one, select text (or
  click into a link) and press the chain-icon button: a small
  bar under the link edits the label and URL, or removes the
  link. Keep links in paragraphs - headings carry plain text
  only.
- **Images** embed in the document as data URIs - a folio document
  is one file that renders fully offline. Pick a picture with the
  image button (or the command palette); the file name seeds the
  alt text. You can also hand-type the standard form
  `![alt](https://example.com/cat.png)` on its own line - folio
  upgrades it to an image directive on the next save. Click an
  image to edit its alt, caption, or replace the file from its
  inspector bar; click it once and press Backspace or Delete to
  remove it. Files over 8 MB are refused (resize first); floating
  images and text wrap are deliberately not supported - layout
  belongs to the theme, not the document.
- **Equations** are fenced `$$` blocks: a line with only `$$`, the
  LaTeX source, then a closing `$$` line. They render typeset
  (KaTeX). Edit the LaTeX in the Markdown view; a bad equation
  shows its error inline instead of breaking the document.
- Clicking any cell or column heading reveals the **table
  inspector** above the table: the column's name, type, unit,
  format, the table's caption, and — for formula columns — the
  ƒx expression, editable in place (the same edit as changing
  the source by hand). Units show in the column headers ("q2
  (£k)") in a separate italic span. The header's **name** is
  editable directly: click it and type to rename the column —
  Enter commits (and drops into the column's first cell), Tab
  moves to the next header, Escape reverts. The unit itself is
  read-only; that is what the inspector is for.
- A table longer than the theme's window (`table.rows.show`,
  default 50) shows its head rows plus a "120 rows x 3 columns -
  showing first 50" line. The full data is always in the document
  (charts, formulas, and queries see every row); click **Open
  dataset** for the full-browse surface: continuous scrolling, a
  Jexl filter (`v > 115 && region != "South"` - the charts'
  language), click-header sorting (a view sort, never written to
  the document), and click-to-edit cells. Esc closes it; the
  grid button on the table's inspector bar opens it too.
- **Import data**: the command palette (Ctrl+K) has "Import data
  from a file (CSV or JSON)" - or try it instantly with
  "Import the demo dataset", a shipped 72-row CSV (and a JSON one
  at `demo/data/site-metrics.json`). The "Open example: report"
  entry shows what a finished imported-data report looks like. The file becomes a typed table in
  the document - numeric columns are inferred, the header names
  become formula-usable column names, and `import: "file.csv"` in
  the source records where the data came from. It is a snapshot,
  not a link: the document stays one offline file. Big imports
  render as windowed tables (see above) and browse in the dataset
  browser.
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
  - `filter: "q2 > 350 && region != 'South'"` — a **Jexl expression**
    over the table's columns (the same language as table
    formulas; text columns included). The legacy form
    `filter: {column: q2, op: gt, value: 0}` (operators `eq`, `gt`,
    `lt`) still works.
  - `sort: {by: growth, order: desc}` — sort by a column, `asc` or
    `desc`.
- **type** is `bar`, `line`, `area`, `pie`, `donut`, or
  `scatter`. Bar/line/area plot the first selected column as
  the category label and the last as the value; pie and donut
  slice by the value (non-negative data only — a negative shows
  as the chart's error text); scatter plots the first selected
  column as x and the last as y, both numeric.
- **caption** is the figure caption.

Chart colors come from the document's style header:
`chart.palette: "muted"` or `"corporate"`.

### Table formulas

A formula column computes from other columns. The expression
language is **Jexl**: numeric columns by name, `+ - * /`,
parentheses, comparisons (`>`, `<`, `==`), logic (`&&`,
`||`, `!`), and ternaries — for example
`q3 > 400 ? "up" : "down"`, or `expr: "(q3 - q2) / q2"` with
`format: percent`. The math catalog is callable two ways: as a
function (`sqrt(x)`, `hypot(re, im)`) or with a pipe — the pipe
binds tighter than arithmetic, so parenthesize its operand:
`((q3 - q2) / q2 * 100) | round(1)`. The catalog: `round`,
`floor`, `ceil`, `abs`, `clamp`, `min`, `max`, `sqrt`, `cbrt`,
`pow`, `exp`, `ln`, `log10`, `log2`, `sin`, `cos`, `tan`,
`asin`, `acos`, `atan`, `atan2`, `sinh`, `cosh`, `tanh`, `deg`,
`rad`, `sign`, `mod`, `hypot`, and the constants `pi`, `tau`,
`e`. Whole columns pipe into the aggregates and signal
transforms (`self.col.q2 | mean()`, `self.col.sig | fft() |
at(k)`): `sum`, `count`, `mean`, `median`, `stdev`, `first`,
`last`, `at`, `dftRe`, `dftIm`, `dftMag`, `dftPhase`, `fft`,
`sma`. See the *Signals and spectra* example for a full
walkthrough.

Formulas may reference other rows and other tables, all through
the same namespaced references (plain Jexl context objects - rows
count from 1 like a spreadsheet's, but addressed by NAME):

- `self.row` — the current row number (1-based).
- `self.prev.q2` — the previous row's value; may read ANY column,
  including the formula's own, which is how running totals work:
  `q2 + (self.row == 1 ? 0 : self.prev.total)`.
- `self.prev2.q2`, `self.prev3.q2`, … — two rows back, three rows
  back: `q2 - self.prev2.q2`. Before the first row they read as
  empty.
- `self.r4.q2` — row 4 of this table. Rows past the data read as
  empty.
- `self.col.q2` — the WHOLE column as an array (numeric or
  earlier formula columns): `self.col.q2 | sum()`,
  `self.col.sig | dftMag(self.row - 1)`.
- `@budget.r3.q2` — row 3 of the table with id `budget` (the `@`
  matches how charts name their source; the bare form
  `budget.r3.q2` works too). `@budget.prev.q2` is that table's
  LAST row - a table has no current row inside another table's
  formula. Referenced table ids must be valid identifiers - no
  hyphens.
- Row-context references (`self.*`, `@table.*`) may read text
  columns too (comparisons); plain names stay numeric-only.

A formula may reference formula columns to its LEFT (they compute
first); referencing a later formula column is an error, and a
plain reference to its own column points you at `_prev`. Only
numeric columns are referenceable in formulas (except through
`_prev`); division by zero yields 0 rather than an error. Formulas
recalculate the moment any cell they depend on changes — including
rows they reference; formula cells are never editable by hand.

## Search

- Press **Ctrl+K** (or the magnifier button in the toolbar) to open
  the search box. Type words you know — "insert table", "regional
  summary", "keyboard shortcuts" — and Enter runs the top result.
  It searches commands, help topics, and the document's sections.
- **Open example: poem / accounts / technical** in the palette
  loads example documents of different genres — pure prose and
  poetry, management accounts (running totals, budget lookups,
  negative growth), and a technical paper (code, equations,
  diagrams).
- **Open example: poem / accounts / technical** in the palette
  loads example documents of different genres — pure prose and
  poetry, management accounts (running totals, budget lookups,
  negative growth), and a technical paper (code, equations,
  diagrams).

## Document settings

- The gear button (toolbar, or search "settings") opens the
  document settings: fonts, heading and body sizes, table style,
  chart palette, and page-break behavior. Everything it edits is
  the style header at the top of the Markdown source — the dialog
  is just a friendlier way to write the same YAML.
- **H1/H2 start a new page** applies when printing (and to PDF
  via the print dialog); a page break in folio is a style, never
  a character in your text.

## Printing and PDF

- Search "print" in the palette (Ctrl+K), or press **Ctrl+P** —
  folio prints the rendered document, never the source editor or
  the toolbar. To get a PDF, choose "Save as PDF" as the
  destination in the print dialog. Charts and diagrams print as
  crisp vector graphics.

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
