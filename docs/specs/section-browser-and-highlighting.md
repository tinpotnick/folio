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
  `index.html`. The textarea auto-grows to its content (sized from the
  overlay's laid-out height) so the overlay never desynchronizes, and
  the page scroll position carries across a view switch. (A
  fixed-height, internally-scrolling source view was tried and
  reverted: it broke that scroll carry-over - see
  docs/blockers/md-view-edit-stall-2026-11-20.md.)
- **No soft wrap**: the editor is `wrap="off"` and both layers use
  `white-space: pre`, so a huge line - a data: URL in an image/audio
  directive - is ONE row that scrolls sideways, not thousands of
  wrapped rows that cost seconds to lay out on every switch to this
  view (measured on WebKitGTK: ~630 ms for an 8-clip audio doc with
  wrapping, ~55 ms without, before the audio preload fix in
  audio-embeds.md). The textarea scrolls itself horizontally; the
  overlay is panned in sync (`scrollLeft`) so caret and colors stay
  aligned.
- **Bounded overlay rows**: with no soft wrap a multi-KB line is one
  unbreakable row, and laying out / painting tens of thousands of
  glyphs per row left the source view visible but uneditable for
  ~20 s on GPU-composited WebKitGTK after a view switch. So the
  overlay never renders a huge row raw:
  - **Data chips**: a `data:<mime>;base64,<payload>` run with a
    payload over 128 chars becomes its own `data` token in
    `highlightMarkdown` (`src/render/highlight.ts`; the token's text
    is the FULL URI, so the round-trip property holds). The overlay
    renders it as a compact chip (`tk-data`: `data:<mime>;base64
[N kB]`). Open the .md in a plain text editor and the string is
    all there; in folio it is a chip.
  - **Truncation**: any other overlay row longer than 1024 chars
    (`MAX_OVERLAY_CHARS` in `src/main.ts`) renders a 1024-char prefix
    plus a `…(+N)` marker (`tk-trunc`).
  - The textarea always holds the full text (it is the model, so the
    round-trip is lossless), the caret's line always renders in full
    raw text (colors align while editing it), and moving the caret
    out re-compacts the line (`refreshCaretLine`). Proofing marks skip
    truncated rows (their spans no longer map 1:1 to tokens); chipped
    lines keep token alignment, so marks still apply there.
- The highlighter recognizes EVERY standard directive opener
  (`table|chart|image|audio|flashcards|value|motion|comment|page`,
  plus `mermaid`), so directive bodies - including multi-KB `src:`
  data-URI lines - take the cheap `directiveLine` path and are never
  inline-scanned. Lines over 8192 chars are a single plain token
  regardless (`MAX_INLINE_LINE`).

## Notes

- The outline and highlighter are UI-free and golden/property tested;
  only the thin host glue lives outside the engine/render modules.
