# Toolbar: one row, menus, and More tools

## Status: accepted (2026-10-21)

## Decision

The toolbar had grown to ~30 buttons in one row. Wider than a laptop
window, it scrolled sideways inside itself, so its right end (search,
settings, dark mode, help) was off-screen with nothing to say so. It
is now one row that always fits: the least-used controls collapse
into menus, and what still does not fit moves into **More tools**.
Same layout on web and desktop.

## Layout (left to right)

- Sidebar toggle; the **folio** wordmark (web only - the desktop
  window's title bar names the app and the document).
- **File**: New (both hosts), Open and Save (desktop only).
- **History**: undo, redo.
- **Block**: the text style menu ("Paragraph ▾": Paragraph,
  Heading 1-3, each shown at its size) and the bulleted / numbered
  list buttons.
- **Format**: B I S U, link.
- **+ Insert ▾**: every insert, grouped (Tables and charts, Media,
  Technical, Music), with an icon and a name each - table, dataset,
  chart, Vega-Lite chart; image, audio clip, record audio; equation,
  code block, Mermaid, Graphviz, SVG drawing, 3D model; Strudel,
  sheet music.
- Spacer, then **⋯ More tools** (only when needed), the view switch,
  search (Ctrl+K), document settings, dark mode, help.

## Contract

- **Same buttons, new places.** The toolbar buttons kept their ids
  and handlers (`#btn-table`, `button[data-block="h2"]`, ...); menus
  hold the real buttons. Inserts that existed only in the palette
  are menu items that run the palette entry's own action
  (`data-insert` = the entry's title): one implementation, two ways
  in.
- **Menus** open under their trigger and close on a pick, a click
  elsewhere, Esc, or a window resize. Triggers and items act on
  mousedown and cancel it, so the document keeps its caret and the
  pick acts there. Menus are `position: fixed`, placed below the
  trigger and clamped to the window (the toolbar clips sideways
  overflow, which would otherwise cut them).
- **Text style menu**: its trigger names the style at the caret
  ("Heading 2"; "Paragraph" when there is none) by mirroring the
  items' `active` state. The current item is ticked, as in any menu.
- **More tools**: groups carry a `data-overflow` rank (1 leaves
  first): dark mode, settings, view switch, history, format, file,
  help, and - last resort, a phone while recording - search. On
  every header resize, all groups go home, then leave in rank order
  until the row fits; then any group that fits again
  comes back, most important first (undo/redo return once B I S U
  have gone). Groups keep their bar order in the menu, each as a
  labelled row ("Format  B I S U", from `data-label`); a lone button
  there shows its own label as a menu row. The Recording · Stop
  button re-fits the row when it appears or goes.
- **One height**: every control in the bar is 36px - a group's 28px
  buttons in its padded, bordered box, and standalone buttons sized
  to match. Every shape is a rounded rectangle (8px; no capsules),
  every control an icon (help is a stroked question mark).
- **Phone width** (≤ 560px): no wordmark, the style menu shows a
  short name (P, H1, H2, H3), Insert shows only its icon, Recording
  · Stop shortens to Stop, and the search button drops its Ctrl K
  hint (≤ 760px).
- **Recording**: Record audio lives in the Insert menu, so while it
  records the bar shows a pulsing **Recording · Stop** button that
  stops it.
- **Focus**: pressing a header button never takes focus from the
  document (mousedown is cancelled), so typing after a click on dark
  mode still goes into the page. Tab still reaches every button.
- **After an insert** the caret is not lost: a new equation opens its
  editor with the placeholder selected (typing replaces it); a new
  chart leaves the caret at the start of the block after it.
- **Dark mode button** shows the mode it switches to: a moon in light
  mode, a sun in dark.
- **Window title**: "<first H1, or Untitled> — folio", in the tab and
  (desktop) the window's title bar (`core:window:allow-set-title`).
- **Keys** (desktop): Ctrl+N new, Ctrl+O open, Ctrl+S save. A
  browser keeps Ctrl+N/O/S for itself; there, New is in the toolbar
  and the palette.

## Acceptance

- e2e: `tests/e2e/toolbar.spec.ts` (one row at 1280/1000/800/390
  with nothing past the edge; More tools holds the rest and gives it
  back; the style menu names the caret's style and sets it; Insert
  places a palette-only insert; recording shows Stop; header clicks
  keep the caret; the window title follows the H1).
- WebKitGTK: `tests/webkitgtk/toolbar-menus.js`.
- First-contact eval: `evals/toolbar-first-contact.md`.
