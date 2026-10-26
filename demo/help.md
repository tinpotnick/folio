# folio help

Everything in folio is one Markdown document: prose, typed tables,
and charts generated from them. This help page is itself a folio
document — written in the same renderer you are working with.

[[_TOC_]]

## The toolbar

- One row, left to right: **New** (and **Open** / **Save** in the
  desktop app), **undo / redo**, the **text style** menu
  (Paragraph, Heading 1-3) with the bulleted and numbered list
  buttons, **B I S U** and **link**, and the **+ Insert** menu. On
  the right: Document / Markdown view, **search** (Ctrl+K), document
  settings, dark mode, and **?** help.
- **+ Insert** lists everything you can add, grouped: tables,
  datasets and charts; images, audio clips and recordings;
  equations, code, diagrams, drawings and 3D models; music; and
  references - a footnote, a citation and a bibliography, a
  cross-reference ("see Table 2") and a table of contents.
- In a narrow window, whatever does not fit moves into **More
  tools** (the **⋯** button), least-used first, and comes back when
  there is room. Nothing is ever off the edge of the bar.
- Every toolbar action is also in the command palette (Ctrl+K):
  search for it in your own words.

## Views and sections

- **Document view** is the rendered report. Click into any text and
  type; table formulas recalculate as you edit.
- Inline formats follow GitHub Markdown plus a few documented
  additions: **bold**, *italic*, `code`, ~~strikethrough~~, and
  ++underline++ (GitHub has no underline, so folio uses `++`).
- The text style menu and the format buttons always show where you
  are: the style menu names the block at your caret ("Heading 2"),
  and the format at your caret lights up — in Document view and in
  Markdown view alike. On heading lines the inline buttons (B, I,
  code) switch off: a heading is already a complete format. In
  Markdown view they also work on the source: Heading 1 prefixes the
  line, B wraps the selection (or word) in `**`.
- **Markdown view** (toolbar toggle) shows the source with syntax
  highlighting. Switch back to Document to re-parse. If a parse
  error appears, fix the reported line — folio stays in source view
  until the Markdown is valid.
- The **sidebar** button at the far left (tooltip "Sections") toggles the outline
  sidebar. Click a section to jump straight to it; the section you
  are reading stays marked as you scroll.

## Unsaved changes

- If you have edited a document and then open another one (an
  example, a link, the guide, a new document, Back, or Open), folio asks
  first: **Save...** (in the desktop app), **Discard changes**, or
  **Cancel**. Closing the window or tab with unsaved edits asks too.
  Undoing all your edits counts as unchanged.

## Starting, the guide, and examples

- The first time you start folio it opens its **getting started
  guide**: what folio is, a live table and chart to try, and links to
  every example document. After that, folio opens on a **new, blank
  document** with the caret in its title.
- **New document**: search "new" in the palette, or press **Ctrl+N**
  in the desktop app. If the open document has unsaved changes,
  folio asks first.
- **The guide** is always one search away: "guide" in the palette, or
  click the **folio** wordmark (top left, in the web version; the
  desktop window's title bar names the document instead).
- **Examples**: search "example" in the palette to open one.
- Links to examples open in place, at the top of the document; the
  browser's **Back** button returns to the previous one. A link such as
  `?doc=demo/examples/poem.md` opens folio straight onto that
  document.

## Drawings from text

- Some code blocks draw a picture instead of showing code. The
  drawing is the figure; click it to see and edit its source (it
  redraws as you type).
- **Graphviz**: a block tagged `dot` draws a graph laid out by
  [Graphviz](https://graphviz.org). List the nodes and edges
  (`a -> b`); Graphviz places them. Search "graphviz" in the palette
  to insert one. The theme sets its fonts and colours unless the
  graph sets its own.
- **Vega-Lite**: a block tagged `vega-lite` holds a
  [Vega-Lite](https://vega.github.io/vega-lite/) chart spec (JSON) for
  heatmaps, layered charts and small multiples. Write
  `"data": {"name": "@my-dataset"}` to chart a folio dataset; the chart
  follows the table as you edit it. Data from URLs is not allowed:
  documents work offline. Search "vega" in the palette to insert one.
- **SVG**: a block tagged `svg` is a hand-written drawing, shown as
  it is. Use `currentColor` (the page's ink) or the theme's colours,
  such as `var(--folio-accent)`, and it follows the theme and dark
  mode. Scripts and anything loaded from the internet are removed.
  Search "svg" in the palette to insert one.
- **Sheet music**: a block tagged `abc` is a tune in
  [ABC notation](https://abcnotation.com), engraved as a score. Click
  it and press **Play** to hear it, through folio's own simple
  synthesizer (nothing is downloaded). Search "sheet music" in the
  palette to insert one.
- The *Drawings from text* example shows each kind.

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
- A model can take its sizes from a **dataset**: write
  `params=@sizes row=2` after `jscad` on the fence, or pick the
  dataset and row in the model's header. The row's columns replace
  the parameter defaults by name, and editing the table redraws the
  model. **Export STL** in the header saves the model for 3D
  printing or CAD.

## Lists

- Start a line with `- ` for a bulleted list or `1. ` for a numbered
  one, in a new paragraph or in the source. The **Bulleted list** and
  **Numbered list** buttons (beside the text style menu, or search "list" in the
  palette) turn the paragraph at the caret into a list, switch
  between the two kinds, and turn a list back into a paragraph.
- **Enter** adds an item; **Enter** on an empty item ends the list.
  Pressing the same list button again (or **Paragraph** in the text style menu, or searching
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

## Footnotes

- **+ Insert › Footnote** (or search "footnote" with Ctrl+K) puts a
  numbered note at your cursor and takes you to the note's text at
  the end of the document. Type the note; you're done.[^how]
- Notes are numbered in the order you refer to them, and gathered
  under **Notes** at the end of the document. Click a number to jump
  to its note, and the ↩ beside a note to jump back.
- Edit a note right there in the Notes list. Enter does nothing in a
  note, because a note is one paragraph.
- In the Markdown view a footnote is GitHub's own syntax: `[^1]` in
  the text and a line `[^1]: The note.` anywhere in the document, so
  GitHub, GitLab and Pandoc show your notes too. A label can be a
  word (`[^source]`); readers still see numbers.

[^how]: This is a footnote. Its number in the text links here.

## Citations and references

- **+ Insert › Bibliography** (or search "bibliography") adds a
  **References** heading and a reference list. Click the list to see
  its source: BibTeX, the format Google Scholar ("Cite" › BibTeX),
  Zotero, Mendeley and journal sites all export. Paste entries there.
- **+ Insert › Citation** (or search "cite") lists the references; pick
  one and folio writes `[@knuth1984]` at your cursor, shown as
  "(Knuth, 1984)". The reference list shows only what is cited, sorted
  and formatted for you; entries not cited yet are listed (on screen
  only) underneath.
- Typing works too, in Pandoc's syntax: `[@knuth1984, p. 99]` adds a
  page, `[see @a; @b]` cites two, `[-@knuth1984]` gives the year alone,
  and `@knuth1984` in a sentence reads "Knuth (1984)".
- **Citation style** in document settings: author-date, APA-like
  "(Knuth, 1984)", or numeric, IEEE-like "[1]" - the citations and the
  list renumber together. Click a citation to go to its entry.
- A citation whose key is not in the bibliography shows as
  "(key?)" in grey; hover it to see which key is missing.

## Numbered tables, figures and cross-references

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

## Table of contents

- **+ Insert › Table of contents** (or search "contents" with
  Ctrl+K) adds a **Contents** list of your document's sections, like
  the one at the top of this help. Click an entry to jump there.
- It keeps itself up to date as you add, rename and move headings.
  A single H1 is treated as the title and left out; three levels of
  headings are listed.
- In the Markdown view it is one line, `[[_TOC_]]` - the same marker
  GitLab and Azure DevOps use (`[TOC]` works too).

## Opening and saving

- **Open** (folder icon, **Ctrl+O**) loads a .md file; **Save**
  (**Ctrl+S**) writes the document to a file you choose, and after
  that back to the same file.
- **In the desktop app** you can also open a .md file straight from
  your file manager: double-click it, or choose **Open with → folio**.
  Save then writes back to that file.
- **In a web browser** the files are on your own computer — nothing
  is uploaded anywhere. Chrome and Edge open and save real files;
  in Firefox and Safari, Open reads a file you pick and Save
  downloads the .md file.
- **Unsaved work is kept as you type**, in this browser (or the
  desktop app). Close the window by accident and it is still there
  the next time you open folio, with a note saying so. Saving, or
  choosing **Discard changes**, lets it go.

## Tables and charts

- folio has two kinds of table. A **Table** is a standard Markdown
  pipe table (`| a | b |`), exactly what GitHub shows; **+ Insert ›
  Table** inserts one. A **Dataset** adds an id, typed columns,
  units, formulas and a caption. Charts and formulas can only use
  datasets.
- Click a table to see its kind at the start of its bar. **Make it a
  dataset** upgrades a table; **Convert to simple table** turns a
  dataset back into a pipe table when nothing would be lost (the
  button says why when it can't). **+ Insert › Dataset** (or
  "dataset" in the palette) inserts one directly.

- The **+ Insert** menu holds the block builders, each placed at
  your caret: Mermaid diagram inserts a starter diagram; Equation a
  typeset `$$` block; Strudel music a playable pattern; Code block
  converts the block you are in to a code block and back (in
  Markdown view it fences the paragraph you are in).
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
  [strudel.cc](https://strudel.cc) for the language. The player
  itself is a free **add-on** (Strudel is AGPL-licensed, folio is
  MIT, so folio does not ship it): the first Play asks, then
  downloads it once and keeps it - after that, playback is offline
  and nothing more is downloaded. Melodic sounds are synthesized,
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
  links all the shipped examples); a web address opens in a new
  tab - in the desktop app, in your own web browser. Links in
  this help work the same way. To create or edit one, select text (or
  click into a link) and press the chain-icon button: a small
  bar under the link edits the label and URL, or removes the
  link. Keep links in paragraphs - headings carry plain text
  only.
- **Images** embed in the document as data URIs - a folio document
  is one file that renders fully offline. Pick a picture with the
  **+ Insert › Image** (or the command palette); the file name seeds the
  alt text. You can also hand-type the standard form
  `![alt](https://example.com/cat.png)` on its own line - folio
  upgrades it to an image directive on the next save. Click an
  image to edit its alt, caption, or replace the file from its
  inspector bar; click it once and press Backspace or Delete to
  remove it. Files over 8 MB are refused (resize first); floating
  images and text wrap are deliberately not supported - layout
  belongs to the theme, not the document.
- **Audio** embeds like an image - a recorded sound is media, the
  temporal sibling of a picture. Pick a file with **+ Insert ›
  Audio clip** (or hand-type an `::: audio` directive with a `src`);
  it plays in the page through the browser's own audio controls.
  Click the figure to edit its alt text, caption, or replace the
  file; click once and press Backspace or Delete to remove it.
  The same 8 MB ceiling applies - and for sounds you want to
  SYNTHESIZE, use a Strudel block instead. **+ Insert › Record
  audio** records straight from the microphone: while it records,
  the toolbar shows a pulsing **Recording · Stop** button and the
  status bar counts; click it to stop, and the clip embeds in
  place. The browser asks for
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
  at `demo/data/site-metrics.json`). The "Open example: An imported data report"
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
  it** on its bar, or search "chart" in the palette (the chart goes
  where your cursor is). You get a bar chart of its first text and
  first number column, split by another text column when the labels
  repeat, which you can then change on the chart's own bar, or in
  the source below.
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
bar per region). Add `stack: true` for stacked bars or stacked
areas. In the
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
  or use the undo/redo buttons after New in the toolbar (grey
  when there is nothing to step). One undo is one action: a burst
  of typing, a cell edit, an insert, a deletion, an inspector
  change. Opening a different document starts the history fresh;
  settings and Markdown-view edits are undoable steps like any
  other change. Text fields keep their own native undo.

## Dark and light mode

- The moon button beside **?** (a sun in dark mode; in More tools
  on a narrow window), or the palette's "Toggle dark mode",
  switches the app - toolbar, section browser, Markdown
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
  (type "example" to list them all); **New document** starts a blank
  one; **Getting started guide** opens the guide.

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
  striped, minimal, banded, ledger), chart palette, citation style
  (author-date or numeric), page-break behavior, and page numbers and
  the running header. Everything it edits is
  the style header at the top of the Markdown source — the dialog
  is just a friendlier way to write the same YAML.
- **H1/H2 start a new page** applies when printing (and to PDF
  via the print dialog); a page break in folio is a style, never
  a character in your text.
- **Page numbers** and the **running header** are on by default:
  every printed or exported page says "Page 2 of 6" at the bottom
  right, and from page 2 the document's title sits at the top left.
  Turn either off in document settings (or search "page numbers").

## Printing and PDF

- **Export as PDF**: the **Export** menu (the arrow-out-of-a-box
  button beside Save), or search "export" or "pdf" in the palette.
  In the desktop app a save dialog asks where, and folio writes the
  PDF itself — A4, the same pages Print makes, with every chart and
  diagram drawn. In a web browser, Export opens the print dialog:
  choose "Save as PDF" as the destination.
- Search "print" in the palette (Ctrl+K), or press **Ctrl+P** —
  folio prints the rendered document, never the source editor or
  the toolbar. To get a PDF, choose "Save as PDF" as the
  destination in the print dialog. Charts and diagrams print as
  crisp vector graphics, always on light paper - even in dark mode.
- Pages are numbered "Page n of N", with the title as a running
  header from page 2 (see Document settings to turn them off).
  Exported PDFs have them unless you turn them off. **In the desktop
  app, Print (and the print dialog's "Print to File") leaves them
  off - use Export as PDF**, then print that file if you want paper.
  When printing from a browser, Chrome and Edge show them, Safari
  does not.

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
  - [Ctrl+P, Print the document (or save it as a PDF)]
  - [Ctrl+N, New document (desktop app; a browser keeps Ctrl+N for a new window)]
  - [Ctrl+S, Save]
  - [Ctrl+O, Open a document]
  - [Esc, Close the help window]
:::

## Getting help

The help window is always one press away: the **? Help** toolbar
button, or the **?** key when you are not typing.

## Supporting folio

folio is free and open source. If it is useful to you, you can buy
its developer a coffee at
[buymeacoffee.com/tinpotnick](https://buymeacoffee.com/tinpotnick) —
or search "support" in the palette (Ctrl+K). Reporting a bug or
sharing folio with someone who would like it helps just as much.
