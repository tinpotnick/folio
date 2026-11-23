# Context menu (right-click)

## Status: accepted (2026-11-20) - implemented on vibe/context-menu-subsup

## Decision

Right-clicking the document always lands on a folio menu, never the
webview's own. On the desktop (Tauri/WebKitGTK) the native context menu
is suppressed document-wide (`contextmenu` default prevented); inside
the document the component shows, in priority order:

1. the proofing menu on a spelling/grammar mark (existing),
2. the table menu in a table cell (existing),
3. otherwise the **general document menu**:

- **Cut** / **Copy** (Ctrl+X / Ctrl+C, disabled when nothing is
  selected), **Paste** (Ctrl+V - reads the clipboard and inserts
  plain text only, the same rule as a real paste event; falls back to
  `execCommand("paste")` where the clipboard API needs a permission),
- **Select all** (Ctrl+A),
- **Add comment** - the same action as the palette's "Add a comment"
  and Insert › Comment (one implementation, `onRequestComment` on the
  component; the host owns the author name),
- **Set comment author** - opens the host's author dialog, the same
  action as the palette's "Set comment author" and clicking a
  comment's author name (`onEditAuthor` on the component; spec:
  docs/specs/comments.md).

The menu is the same `.folio-menu` as the table menu: Escape closes
it, a pointer press outside closes it, it is clamped into the window.

On the web (a browser), right-clicks outside the document keep the
browser's own menu; inside the document folio's menus win as before.

## Contract

- `handleContextMenu` (src/component.ts) tries proofing, then table,
  then `openGeneralMenu` - every path `preventDefault()`s, so no
  engine's default menu can appear over the article.
- Cut/copy/paste act on the current selection inside the article;
  paste inserts `text/plain` only (never markup, never a render
  dependency), exactly like the paste event path.
- Insert › Comment (toolbar Insert menu, `data-insert="Add a comment"`)
  runs the palette action, so menu, palette and context menu share one
  implementation.

## Acceptance

- e2e: `tests/e2e/context-menu.spec.ts` (right-click opens the general
  menu; Cut/Copy disabled with no selection; Add comment on a
  selection quotes it; Escape and outside click close the menu;
  Insert › Comment works).
- WebKitGTK: `tests/webkitgtk/context-menu-native.js` (the menu opens
  on a synthetic contextmenu and Add comment lands an aside).
- First-contact eval: `evals/comments-first-contact.md` mentions the
  right-click and Insert paths.
