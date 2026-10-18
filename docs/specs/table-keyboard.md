# Table cell editing and keyboard navigation

## Status: accepted (2026-10-18)

## Decision

Table data cells are nested editable, focusable leaves inside the
component's article; formula cells stay read-only. Cell edits commit
to the model the moment the cell is left, recalculating formulas and
charts in place. Tab/Shift+Tab/Enter navigate cells and grow the
table at the edges.

## Contract

- **Cells**: data cells get `contenteditable="true"` +
  `tabindex="-1"` (focusable leaves); formula cells are
  non-editable. Without focusable cells the article keeps focus,
  cell edits never commit (typed data was lost on the next render),
  and Tab escaped to the host toolbar.
- **Click-to-focus**: browsers hand click focus to the article (the
  outer editing host), so the component focuses the clicked cell
  itself (mousedown record, mouseup focus, caret restored at the
  click position via `caretRangeFromPoint` where it pierces).
- **Commits**: on blur and before navigation. Idempotent, and
  surgical: only the row's formula cells and dependent charts are
  refreshed in place — never a table re-render while editing (that
  destroyed the caret mid-typing).
- **Ctrl/Cmd+A in a cell selects the cell**, never the whole
  article (the browser's select-all from a cell could otherwise
  replace the entire document with the next keystroke). Selection is
  written via the shadow root's selection only; where no shadow
  selection exists (WebKitGTK) it stays inert rather than
  destructive — the document-level selection cannot write ranges
  inside the shadow tree and doing so corrupts the caret there.
- **Navigation**: Tab/Shift+Tab move across editable cells (formula
  columns are skipped, wrapping across rows); Enter/Shift+Enter
  move down/up a column. Tab or Enter past the last row appends a
  row. The edited cell commits first.
- **Engine differences** (verified against WebKitGTK 2.54 via
  MiniBrowser + WebKitWebDriver):
  - Chromium moves focus to the article when text is typed into a
    nested editable cell (the caret stays in the cell), so keyboard
    events resolve the cell from the event target, the caret (shadow
    selection), or the last focused cell.
  - WebKitGTK provides no selection API that pierces the shadow root,
    and focusing a cell does not move the caret into it. There
    Tab/Enter commit the cell and keep the caret in place (the user
    clicks the next cell); moving focus without the caret would send
    typed text into the wrong cell or nowhere. Row growth and
    recalculation behave the same.

## Acceptance

- `just lint`, `just test`, `just build` green; e2e in
  `tests/e2e/app.spec.ts` ("table editing and keyboard navigation"):
  commit + recalc + Markdown survival, Tab growth, Enter growth.
- First-contact eval: `evals/table-entry-first-contact.md`.
- Verified end-to-end in WebKitGTK: click, type, Tab (commit +
  recalc), click next cell, type, Tab — `[North, 400, 500]` in the
  source, growth 25.0%, nothing lost.
