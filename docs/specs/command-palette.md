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
    help window and reveals that topic.
- **Matching** is a dependency-free subsequence fuzzy match with
  bonuses for adjacent characters and word starts, over the title
  plus a keyword string. Empty query lists everything, commands
  first, capped at 30 rows.
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
