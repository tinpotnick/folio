# Welcome page

## Status: accepted (2026-10-21)

## Decision

folio boots into a FRONT PAGE, `demo/welcome.md`, not into an
arbitrary report. The page sells folio honestly, by being a folio
document:

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

## Navigation

- **Home**: the header's **folio** wordmark is a button that opens
  the welcome page; the palette has **Open the welcome page**
  (keywords: welcome, home, start, front page, about, examples).
- **Examples**: links on the page and the palette's **Open example:
  ...** entries load in place.
- **History**: every shipped document opened in place (welcome,
  examples, followed links) is a browser history entry with its own
  `?doc=` address. Back and Forward move between documents instead
  of leaving folio. A newly opened document starts at its TOP; Back
  returns to where the reader was on the previous one. Opening a
  document clears the toolbar's block/format highlights (there is no
  caret in it yet).
- **Deep link**: `?doc=<path>.md` boots straight into a shipped
  document (same-origin relative `.md` paths only; anything else,
  such as a URL with a protocol or `..`, falls back to the welcome
  page). The e2e suite boots the sample this way.

## Acceptance

- e2e: `tests/e2e/welcome.spec.ts` (boots into the welcome page; the
  live table recalculates on edit; ten example links in a list; a
  link opens the sample in place and the wordmark comes home; `?doc=`
  works and rejects junk; palette entries; an opened document starts
  at its top; Back returns home, to the reader's place, and Forward
  returns; no stale toolbar highlight after opening).
- First-contact eval: `evals/welcome-first-contact.md`.
