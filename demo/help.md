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
- **Markdown view** (toolbar toggle) shows the source with syntax
  highlighting. Switch back to Document to re-parse. If a parse
  error appears, fix the reported line — folio stays in source view
  until the Markdown is valid.
- **☰ Sections** toggles the outline sidebar. Click a section to
  jump straight to it.

## Opening and saving

- **Desktop app:** Open… loads a .md file from disk; Save… writes
  the current document to a file you choose.
- **Web:** switch to Markdown view and copy the source — the plain
  Markdown text is the document.

## Tables and charts

- **+ Table** inserts a typed table at the cursor.
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
