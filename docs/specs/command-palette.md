# Command palette (search)

## Status: accepted (2026-10-18)

## Decision

One search box over everything folio can do: toolbar commands,
document sections, and help topics. The toolbar keeps the everyday
controls; the palette carries the long tail so the toolbar never
grows into a wall of buttons. Triggered by Ctrl+K / Cmd+K and the
magnifier button in the toolbar.

## Contract

- **UI**: a `<dialog id="palette-modal">` with a single input and a
  result list. Esc closes (native dialog behavior); ↑/↓ move the
  selection; Enter runs the highlighted entry; click runs any entry.
  Each entry shows a group tag: Command, Section, or Help.
- **Discoverability**: the toolbar's search button carries a
  visible `Ctrl K` keyboard hint (not just a tooltip) - a new
  user must see that search exists without hovering anything.
- **Entries** are rebuilt on every open, so the view command
  reflects the current state and the sections/help topics reflect
  the current documents:
  - Commands: switch view, insert table, insert diagram, toggle
    code block, toggle sections, open help; Open/Save on desktop
    only (the palette never shows actions the host cannot run).
  - Sections: every heading from the component's `getOutline()`;
    running one reveals the section (`revealBlock`).
  - Help topics: every heading of the help document, via the help
    component instance's `getOutline()`; running one opens the
    help window and reveals that topic. A help topic also matches
    when the query appears anywhere in its section's text, so
    "stacked" finds the charts topic though no heading says it.
- **Matching** is a dependency-free subsequence fuzzy match with
  bonuses for adjacent characters and word starts, over the title
  plus a keyword string; a query appearing VERBATIM in an entry
  scores a large bonus, so "poem" ranks the poem example over a
  command whose keywords merely contain p...o...e...m scattered
  about. A verbatim match is scored as one contiguous run (plus a
  word-start bonus), not letter by letter - the letter walk took the
  first "g" for "guide" and lost "Getting started guide" to help
  topics. A query found in an entry's TITLE scores above the same
  query among keywords ("new" is New document). Every word of a
  query found as a word among an entry's title and keywords matches
  too, in any order (2026-10-29): "fewer rows" finds "Choose how
  many rows a table shows", which the letter walk missed because the
  words came in another order. Empty query lists EVERY command, then the first ten
  sections and the first ten help topics: one global cap let each
  new command push sections and help out of the empty state.
- **Command actions reuse the toolbar handlers** (`.click()` on the
  existing buttons): the palette is a discovery layer, never a
  second implementation of an action.
- The view-switch state is read from the `md-wrap` hidden attribute
  (the textarea's own hidden state is inherited and always false).

## Acceptance

- e2e: `tests/e2e/palette.spec.ts` (open/close, grouping, run a
  command, jump to a section, open a help topic, keyboard
  navigation, empty state, web hides file commands, state-aware
  view command).
- First-contact eval: `evals/command-palette-first-contact.md`.
- `just lint`, `just test`, `just build` stay green.
