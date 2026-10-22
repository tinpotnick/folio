# Section browser and highlighted Markdown source

## Status: accepted (2025-12-12)

## Feature 1: section browser (left sidebar)

A collapsible left sidebar in the host app, like the navigation pane in
Microsoft Word. It lists the document's sections (headings) with their
outline; clicking one scrolls the document to that section.

Contract:

- Engine: `outlineOf(doc)` in `src/engine/outline.ts` returns
  `OutlineEntry { blockIndex, level, text }[]` — pure, headless,
  tested in `tests/engine/outline.test.ts`.
- Component (`<folio-doc>`):
  - `getOutline(): OutlineEntry[]`
  - `revealBlock(blockIndex)` scrolls smoothly to the block and puts
    the caret at its start (like Word's navigation pane: typing
    continues there and the toolbar shows the heading's level), with
    no focus ring. A read-only document focuses the block instead.
  - `lastBlockInView()`: the last block whose top is in the window.
  - `firstVisibleBlockIndex(viewTop = 0)` reports which block is at
    the top of the visible page; `viewTop` is the bottom of the
    host's sticky bar, so a block hidden under the toolbar does not
    count as visible.
- Host: an icon-only sidebar toggle at the left edge of the header
  (above the sidebar it controls) - a stroked panel icon like the
  other toolbar icons, tooltip "Sections", no text label - toggles
  the sidebar (`hidden` attribute) and shows as pressed
  (`aria-pressed`) while it is open. Clicking a section in Markdown view parses the source
  first and reveals the rendered section.
- The sidebar sticks exactly under the toolbar (`top: --header-h`),
  so its contents do not shift as the page scrolls.
- Landing (2026-10-21): the page's `scroll-padding-top` is the
  toolbar's measured height (`--header-h`, kept by a ResizeObserver)
  plus 16px, so a revealed heading lands just below the toolbar - not
  under it.
- Active section: the entry whose heading is the last one at or above
  the top of the visible page - from the moment the sidebar opens, not
  only after a first click. At the very end of the page, where the
  last sections cannot reach the top, it is the last heading in view.
  A clicked entry is active at once and stays active until the jump's
  scrolling settles.
- Look: the toolbar's language - neutral surfaces, sentence-case
  "Sections" label, 6px radii. The document title leads in the text
  ink; nested sections hang off a guide line, and the active one marks
  it in the active ink (`--active-bg`) on a `--surface-2` background.
  No accent blue.

Acceptance: an agent playing a new user, without instructions,
opens/closes the sidebar, sees all headings, and clicks one to zoom to
it (eval: `evals/section-browser-first-contact.md`). E2E:
`tests/e2e/sections.spec.ts`.

## Feature 2: Markdown source with syntax highlighting

The Markdown view is a text editor experience like VS Code: proper
code coloring, monospace, line-number gutter, while remaining a plain
text editing surface (a native textarea — no code mirror, no new
dependency per ADR-0007).

Contract:

- `highlightMarkdown(src)` in `src/render/highlight.ts` returns
  per-line typed tokens (`MdLine { tokens: MdToken[] }`,
  `MdToken { kind, text }`). Pure string computation, no HTML strings,
  no injection surface; tested in `tests/render/highlight.test.ts`
  including a round-trip property: concatenated token text always
  equals the source.
- Host: a transparent `textarea` overlays a highlighted `<pre>`; both
  share identical font metrics so the caret sits exactly on the
  colored text. Token kinds map to CSS classes `tk-<kind>` in
  `index.html`. The textarea auto-grows to its content so the overlay
  never desynchronizes.

## Notes

- The outline and highlighter are UI-free and golden/property tested;
  only the thin host glue lives outside the engine/render modules.
