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
- **Per-keystroke commits:** cell text commits to the model on
  every input event, not only on blur/navigation — Chromium moves
  DOM focus to the article on the first keystroke, so blur-based
  commits alone lost everything typed after the first character.
  Committing is idempotent and surgical (formula cells and charts
  refresh in place; the table is never re-rendered mid-typing).
- **Caret context beats history:** when a resolvable caret exists
  and sits OUTSIDE any cell (e.g. the user clicked into a paragraph
  after using the table), Enter acts on the caret's block — the
  last-used cell is only a fallback for engines with no pierceable
  selection (WebKitGTK). Otherwise a stale cell hijacked Enter and
  grew the table from a paragraph.
- **Pointer context beats cell history (WebKitGTK):** where no
  caret is resolvable at all, the fallback cell is only valid
  while the most recent CLICK resolves inside its table: clicks
  resolve through the shadow root's hit testing (the one pierce
  WebKitGTK has), so a click into a paragraph drops the stale
  cell — otherwise the focused article kept it authoritative and
  Enter grew the table from the paragraph (the bug returned on
  desktop after the Chromium fix, which cannot fire there).
  Verified in WebKitGTK: click a cell, Enter moves down the
  column; click a paragraph, Enter does not grow the table and
  clears the stale cell.
- **Navigation**: Tab/Shift+Tab move across editable cells (formula
  columns are skipped, wrapping across rows); Enter/Shift+Enter
  move down/up a column. Tab or Enter past the last row appends a
  row. The edited cell commits first.
- **A new row left blank goes** (2026-10-28): the row Tab/Enter
  appended is provisional. Typing anything in it keeps it; leaving it
  with nothing typed - a press or focus anywhere outside it - removes
  it again, so Enter pressed to confirm a value (a habit) never
  leaves a stray empty row (it did in a one-row assumptions table).
  Tab/Enter past a blank new row add no second one. Removal is in
  place - the row element and the model row; formulas, other tables
  and charts refresh - never a table re-render, so a press on another
  cell of the same table still focuses it. Only the last row is ever
  removed, never a table's only row, and rows added on purpose
  (Insert row below) are not provisional. On WebKitGTK the caret
  stays in the old cell after Enter, so the new row is left by the
  next press (verified natively: `tests/webkitgtk/
  table-new-row-native.js`).
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
  commit + recalc + Markdown survival, Tab growth, Enter growth, a
  blank new row removed on leaving (and not saved), a typed one kept.
- First-contact eval: `evals/table-entry-first-contact.md`.
- Verified end-to-end in WebKitGTK: click, type, Tab (commit +
  recalc), click next cell, type, Tab — `[North, 400, 500]` in the
  source, growth 25.0%, nothing lost.
