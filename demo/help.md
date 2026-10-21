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

## Welcome page and examples

- folio opens on its **welcome page**: what folio is, a live table
  and chart to try, and links to every example document. Click the
  **folio** wordmark (top left), or search "welcome" in the palette,
  to come back to it.
- Links to examples open in place, at the top of the document; the
  browser's **Back** button returns to the previous one. A link such as
  `?doc=demo/examples/poem.md` opens folio straight onto that
  document.

## 3D models

- A code block tagged `jscad` draws a **3D model** from
  [JSCAD](https://openjscad.xyz) code: search "3D model" in the
  palette, or pick "JSCAD (3D model)" as a code block's language. The
  model is the figure; click it to see and edit its code (it redraws
  as you type), drag it to turn it, or pick Front / Right / Top in its
  header.
- Write `main()` returning shapes from `require('@jscad/modeling')`,
  the way JSCAD's own examples do; `getParameterDefinitions`
  defaults are used. The code runs sealed off: no network, no files,
  and at most five seconds. The *Parametric parts* example shows a
  bracket, a gear and a coloured assembly.

## Lists

- Start a line with `- ` for a bulleted list or `1. ` for a numbered
  one, in a new paragraph or in the source. The **Bulleted list** and
  **Numbered list** buttons (beside P, or search "list" in the
  palette) turn the paragraph at the caret into a list, switch
  between the two kinds, and turn a list back into a paragraph.
- **Enter** adds an item; **Enter** on an empty item ends the list.
  Pressing the same list button again (or **P**, or searching
  "paragraph" in the palette) turns each item back into its own
  paragraph.
  Items take bold, italic, code and links like any paragraph.
- **Tab** nests an item under the one above it; **Shift+Tab** lifts
  it back out, and on a top-level item turns it into a normal
  paragraph (or search "indent" / "outdent" in the palette).
  **Backspace** at the start of an item does the same step back
  before it joins any lines. A
  nested list can be bulleted inside a numbered one, or the other way
  round: with the caret in the sub-list, press the Bulleted or
  Numbered list button (it changes just that sub-list), or type
  `- ` / `1. ` in an empty item. In the source, nesting is indentation, the standard
  Markdown way: an item indented under the one above (two spaces
  under `- `, three under `1. `) is its sub-item.
- Numbered lists number themselves when saved. **Enter** on an empty
  nested item lifts it one level; on an empty top-level item it ends
  the list.

## Opening and saving

- **Desktop app:** the Open button (folder icon) loads a .md file
  from disk; Save (arrow-down icon) writes the current document to
  a file you choose.
- **Web:** switch to Markdown view and copy the source — the plain
  Markdown text is the document.

## Tables and charts

- folio has two kinds of table. A **Table** is a standard Markdown
  pipe table (`| a | b |`), exactly what GitHub shows; the table
  button inserts one. A **Dataset** adds an id, typed columns,
  units, formulas and a caption. Charts and formulas can only use
  datasets.
- Click a table to see its kind at the start of its bar. **Make it a
  dataset** upgrades a table; **Convert to simple table** turns a
  dataset back into a pipe table when nothing would be lost (the
  button says why when it can't). Search "dataset" in the palette
  to insert one directly.

- The insert group (seven icons after the format buttons) holds the
  block builders: table, Mermaid diagram, image, audio clip,
  equation, Strudel music, and code block. The
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
  instruments - stay silent here, because those sounds are not in
  folio's offline kit; drop the `.bank(...)` to use folio's drums. An
  example that loads its own sounds from the internet
  (`samples('github:...')`, as many strudel.cc examples do) asks
  first: pressing Play shows a warning naming what it would
  download. **Download and play** fetches them (you need a
  connection, and you're asked once per session); **Play without
  them** plays everything else, fully offline. The *Amensister*
  example works this way.
- If something in a pattern fails while it plays (a sound that won't
  load, a scale name this version of Strudel rejects), the block's
  header says **Some sounds failed: ...** and the rest keeps playing.
  For example, current Strudel wants `.scale('G0:minor')`, not
  `'G0 minor'`.
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
- **Audio** embeds like an image - a recorded sound is media, the
  temporal sibling of a picture. Pick a file with the speaker
  button (or hand-type an `::: audio` directive with a `src`);
  it plays in the page through the browser's own audio controls.
  Click the figure to edit its alt text, caption, or replace the
  file; click once and press Backspace or Delete to remove it.
  The same 8 MB ceiling applies - and for sounds you want to
  SYNTHESIZE, use a Strudel block instead. The mic button records
  straight from the microphone: click to start, click again to
  stop (the button pulses and the status bar counts while
  recording); the clip embeds in place. The browser asks for
  microphone permission the first time.
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

- The quickest way to a chart: click a dataset and press **Chart
  it** on its bar, or search "chart" in the palette. You get a bar
  chart of its first text and first number column, which you can
  then change on the chart's own bar, or in the source below.
- **source** points at a table by its anchor id (`@regional-data`).
- **query** has three parts, all optional except `select`.
- **query: select** `[column, column]` names the columns to plot.
  The first selected column labels the bars; the last is the value.
- **query: filter** `"q2 > 350 && region != 'South'"` is a **Jexl
  expression** over the table's columns (the same language as table
  formulas; text columns included). The legacy form
  `filter: {column: q2, op: gt, value: 0}` (operators `eq`, `gt`,
  `lt`) still works.
- **query: sort** `{by: growth, order: desc}` sorts by a column,
  `asc` or `desc`.
- **type** is `bar`, `line`, `area`, `pie`, `donut`, or
  `scatter`. Bar/line/area plot the first selected column as
  the category label and the last as the value; pie and donut
  slice by the value (non-negative data only — a negative shows
  as the chart's error text); scatter plots the first selected
  column as x and the last as y, both numeric.
- **caption** is the figure caption.

**Several series**: select more than one value column
(`select: [month, revenue, cost]`) for grouped bars or several lines,
or split one value by a column with `series: region` (one line or
bar per region). Add `stack: true` to stack bars or areas. In the
chart's bar these are **Split by** and **Stack**. A legend appears
under the chart.

Charts label values the way the table does: a `format: percent`
column reads `21.6%` on the chart too. Chart colors come from the
theme. To pick a palette yourself, set
`chart.palette` in the style header: `muted`, `corporate`, `ink`,
`warm`, `sepia`, `vivid`, `news`, `jewel`, `mono`, or `swiss`. Each
has a matching set for dark mode.

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

Computed cells show at most six decimal places (`0.006213`, not
`0.0062132653273250064`); the exact value is still what formulas,
charts and exports use. A table wider than the page scrolls
sideways inside the page.

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

## Undo and redo

- Press **Ctrl+Z** to undo, **Ctrl+Shift+Z** (or Ctrl+Y) to redo -
  or use the undo/redo buttons at the front of the toolbar (grey
  when there is nothing to step). One undo is one action: a burst
  of typing, a cell edit, an insert, a deletion, an inspector
  change. Opening a different document starts the history fresh;
  settings and Markdown-view edits are undoable steps like any
  other change. Text fields keep their own native undo.

## Dark and light mode

- The moon button beside **?** (or the palette's "Toggle dark
  mode") switches the app - toolbar, section browser, Markdown
  source, dialogs - between light and dark. The choice is
  remembered, and the first visit follows the system preference.
  The document re-dresses with the app in its theme's OWN dark
  colors (a Manuscript page goes warm brown-black, a Corporate
  report deep navy), charts and diagrams included. The theme saved
  in the document never changes, and printing always uses the light
  version.

## Search

- Press **Ctrl+K** (or the magnifier button in the toolbar) to open
  the search box. Type words you know — "insert table", "regional
  summary", "keyboard shortcuts" — and Enter runs the top result.
  It searches commands, help topics, and the document's sections.
- **Open example: ...** in the palette loads any shipped example
  (field-operations, poem, accounts, report, technical,
  signal-processing, music); **Open the welcome page** goes back to
  the front page.

## Themes

- A theme changes the whole look at once: fonts, heading style,
  table style, colors, and chart palette, in light AND dark mode.
  Search "theme" in the palette (**Change theme**), or open the
  document settings (sliders icon) and pick a card: Folio,
  Corporate report, Technical, Editorial, Manuscript, Modern,
  Newsroom, Elegant, Academic, Swiss. Each card previews its paper,
  title face, and colors.
- Picking one writes the `theme:` line at the top of the source.
- Individual settings below the cards still override the theme,
  key by key. Overridden fields are marked, the dialog counts
  them, and **Reset to theme** clears them all.

## Document settings

- The sliders button (toolbar, or search "settings") opens the
  document settings: the theme picker first, then overrides for
  fonts, heading and body sizes, table style (booktabs, plain,
  striped, minimal, banded, ledger), chart palette, and page-break
  behavior. Everything it edits is
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
