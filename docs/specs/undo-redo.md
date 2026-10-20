# Undo and redo

## Status: accepted (2026-10-20)

## Decision

The document model is a plain tree, so history is SNAPSHOTS of
the block list - no command pattern, no inverse operations to get
wrong. Snapshots are taken at the ONE chokepoint every model
change already flows through (`emitChange`), grouped into undo
steps by what the user considers an action.

## Contract

- **Snapshots**: `cloneBlocks` rebuilds objects and arrays node
  by node but shares STRINGS (immutable in JS) - a document full
  of audio data URIs snapshots for the cost of its structure,
  never its media bytes. The stack holds at most 100 pre-images.
- **Grouping** (a step = one user action): changes with the same
  label within 600 ms merge (a typing burst is ONE undo); any
  changes within 100 ms merge whatever their labels (one action
  emits several times - a keystroke commits a cell AND syncs the
  article). Labels: `type`, `cell`, `insert`, `delete`, `load`
  (model-level loads), `edit` (inspectors, formatting, and the
  rest). A new group pushes the last committed state as the
  step's pre-image and clears redo.
- **Keyboard**: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y inside the
  component's shadow root (the inspector's inputs keep their
  native per-field undo - their keystrokes are their own). The
  HOST routes the same shortcuts app-wide when focus is on
  toolbar buttons or the page body, so undo works wherever the
  caret is not; text fields (the Markdown source textarea
  included) always keep native undo.
- **Restore**: `undo()`/`redo()` swap the block list, re-render,
  re-emit (restores never re-enter history), and REFRESH FOCUS
  to the block the caret was in - the restore's render replaces
  the article, and without this a follow-up Ctrl+Z would go
  nowhere.
- **Load semantics**: a DIFFERENT document (open, example,
  followed link) clears the history; the same bytes (a view
  round-trip) keep it; `keepHistory: true` (settings apply,
  markdown-view edits round-tripped through the view switch)
  makes the load ONE undo step instead of a reset.
- **Host surface**: an undo/redo button group at the front of
  the toolbar, mirrored from the component's `folio-history`
  event (`canUndo`/`canRedo`) - disabled means nothing to step;
  palette entries "Undo" / "Redo" reuse the same methods.

## Acceptance

- e2e: `tests/e2e/undo.spec.ts` (typing burst, insert, cell
  edit, figure removal, button mirroring, new-document reset,
  markdown-edit step, redo everywhere).
- First-contact eval: `evals/undo-redo-first-contact.md`.
