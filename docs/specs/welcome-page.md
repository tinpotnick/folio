# Welcome page

## Status: accepted (2026-10-21)

## Decision

The FRONT PAGE, `demo/welcome.md` ("Welcome to folio"), is a
getting-started guide, not an arbitrary report. It sells folio
honestly, by being a folio document:

- **Getting started** (2026-10-21): five numbered steps - start a
  document (palette "new", Ctrl+N), add structure (toolbar headings
  and lists; everything else via Ctrl+K in the user's own words),
  change the look ("theme"), open an example ("example"), and come
  back to the guide ("guide").
- **What it is**: a document, not a notebook; plain Markdown
  underneath; style lives in themes; works offline.
- **Proof on the page**: a live table (a formula column computing
  each item's share) and a chart drawn from it. The first thing a
  visitor can do is edit a number and watch both follow.
- **What it can do**: the capabilities, each phrased in words a new
  user would search the palette for.
- **Example documents**: a list linking every shipped example, each
  opening in place.

It wears the `modern` theme, and it uses only semantic Markdown,
like every document.

The former boot document, the Q3 Field Operations Review, is now
the first example (`demo/examples/field-operations.md`). It is still
the north-star sample (docs/specs/sample-document.md).

## Boot (2026-10-21)

- A `?doc=` link opens that document.
- Otherwise, the FIRST launch (no `folio.guided` key in
  localStorage) opens the guide and sets the key; every later launch
  opens a **blank document**: `# ` (an untitled H1) with the caret
  in it. Without storage (a private window) folio opens blank rather
  than showing the guide every time.
- The blank page reads as paper: the host sets
  `--folio-page-min-height`; an empty first H1 shows "Untitled", and
  a document that is only that empty title shows one muted line:
  "Type a title, then press Enter to start writing. Ctrl+K finds
  tables, charts and everything else." Both are CSS, never content.
- **New document** (palette; Ctrl+N, which a browser keeps for a new
  window but the desktop app gives to folio) opens a blank document
  at the bare address, after the unsaved-changes check.
- An empty heading (`#` or `# `) parses as a heading with no text
  (CommonMark); a prose line starting with `#` that is not a heading
  (`#hashtag`, `####### seven`) is prose. Both used to loop the
  parser forever.

## Navigation

- **Home**: the header's **folio** wordmark is a button that opens
  the guide; the palette has **Getting started guide** (keywords:
  guide, getting started, welcome, home, tour, examples).
- **Examples**: links on the page and the palette's **Open example:
  ...** entries load in place. The palette names each example as the
  guide lists it ("Open example: Parametric parts"); its short id
  ("3d-models") is a keyword.
- **A playground**: edits to the guide (its live table) never count
  as unsaved changes (docs/specs/unsaved-changes.md).
- **History**: every shipped document opened in place (welcome,
  examples, followed links) is a browser history entry with its own
  `?doc=` address. Back and Forward move between documents instead
  of leaving folio. A newly opened document starts at its TOP; Back
  returns to where the reader was on the previous one. Opening a
  document clears the toolbar's block/format highlights (there is no
  caret in it yet).
- **App-relative paths** (2026-10-22): shipped documents are
  addressed relative to the app's page (`demo/welcome.md`, never
  `/demo/...`), and the build uses a relative base (`./`), so one
  build serves from "/", from a subfolder (the GitHub Pages site at
  /folio/, deployed by `.github/workflows/pages.yml` on every push to
  main) and inside the desktop app. A followed link's path is made
  app-relative before loading.
- **Deep link**: `?doc=<path>.md` boots straight into a shipped
  document (same-origin relative `.md` paths only; anything else,
  such as a URL with a protocol or `..`, is ignored and boots as
  above). The e2e suite boots the sample this way.

## Acceptance

- e2e: `tests/e2e/welcome.spec.ts` (first launch shows the guide,
  later launches a blank page with the caret in its title; New
  document and its unsaved-changes check; boots into the guide; the
  live table recalculates on edit; thirteen example links in a list; a
  link opens the sample in place and the wordmark comes home; `?doc=`
  works and rejects junk; palette entries; an opened document starts
  at its top; Back returns home, to the reader's place, and Forward
  returns; no stale toolbar highlight after opening).
- First-contact eval: `evals/welcome-first-contact.md`.
