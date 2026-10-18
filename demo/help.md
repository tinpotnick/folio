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
- **☰ Sections** toggles the outline sidebar. Click a section to
  jump straight to it.

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
  source in the Markdown view and switch back to re-render.
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

## Keyboard shortcuts

::: table {#help-shortcuts}
caption: "Shortcuts"
columns:
  - {name: shortcut, type: text, width: 34}
  - {name: action, type: text}
data:
  - [?, Open this help]
  - [F1, Open this help]
  - [Esc, Close the help window]
:::

## Getting help

The help window is always one press away: the **? Help** toolbar
button, or the **?** key when you are not typing.
