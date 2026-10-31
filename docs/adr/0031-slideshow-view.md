# ADR-0031: Slideshow - play a document as slides

Date: 2026-10-31

Status: proposed

## Context

folio merges spreadsheets into documents and feeds them to charts and
compute blocks; the natural next application is the deck. Page breaks
on H1/H2 already exist as a print-only style (`pagebreak.h1` /
`pagebreak.h2`, docs/specs/document-settings.md), themes already own
every visual decision (ADR-0002), and print/PDF is one pipeline
(ADR-0025). A "PowerPoint" could therefore be something you do to a
Markdown document rather than a layout engine or a second file type.

## Decision

- **No `mode:` frontmatter, no separate Slides view, no
  document-level marker of any kind.** The file is always plain
  Markdown. You hit play: a toolbar/palette command toggles a
  **slide-rendering flag** on the document view (one slide per H1)
  together with fullscreen; Esc or the button toggles both off. View
  and display state are session state, never written to the file.
- **One slide per H1, uniformly - no special first-H1 presentation
  title.** The first H1 is the first slide. H2-H6 stay in-slide
  headings. While slide rendering is on, the TOC lists every H1.
- The document view keeps every slide in the DOM whether or not slide
  rendering is on (WYSIWYG editing works via the same `syncFromDom`
  as today) but never windows - removing off-screen slides from the
  DOM would break the DOM-is-source-of-truth editing model
  (docs/specs/section-windowing.md).
- Slide aesthetics are new closed theme keys, applied only while slide
  rendering is on: `slide.scale` multiplies the theme's normal type
  ramp (so book-body text reads as slide-body text - one factor, not
  new absolute sizes), plus `slide.background`, `slide.title.size` /
  `slide.body.size` overrides, and `slide.image: full-bleed |
  contained` with per-block rules (bullets as slide bullets, blockquote
  as pull-quote, tables/charts at slide width, code/math at body
  scale). Composition keys (`slide.valign`, `slide.title`) center
  sparse slides (lone sentence, quote, pure title slide); slides are
  single-column, so an image beside text stacks above it. An
  image-only slide renders full-bleed as the deck's
  divider/background mechanism. Per-slide background color stays
  inexpressible (no inline styling, ADR-0002).
- Paper size becomes a closed style key `page.size` (default `a4`;
  typed values `a4` | `letter` | `a5` | `16:9` | `4:3` | ...), read by
  all three places that currently hard-code A4: the print stylesheet's
  `@page` (index.html), desktop `export_pdf`'s PageSetup, and the
  furniture stamper's fallback. A raw Markdown file assumes A4.
- While slide rendering is on, the effective `page.size` is the slide
  aspect (`16:9` by default, from the theme's `slide.aspect`) - set for
  the session, never written to the file. Printing or exporting then
  paginates one slide per page (`break-before: page` on H1s) via the
  existing print pipeline (`preparePrint` gains one step: keep slide
  rendering on if it was on). With slide rendering off, printing is
  unchanged: continuous paper at the document's `page.size`.

## Consequences

- The document model is untouched by construction: no new block kinds,
  no frontmatter keys, golden round-trip tests unaffected, and a
  presented deck saves byte-identical to before presenting.
- The hard problems are deferred by construction: no windowed slides,
  no two-column layouts, no per-slide background colors, no
  auto-splitting of overflowing slides. The former A4 blocker is
  resolved by making paper size a style key with an A4 default rather
  than a constant.
- Ship cost per AGENTS.md: palette + in-app-help entries, first-contact
  eval, unit + e2e tests, spec docs/specs/slides.md moves to accepted.

## Alternatives rejected

- A `mode: slides` frontmatter line (an earlier draft of this ADR):
  makes slide-ness a property of the document, implying two document
  types and drifting from Markdown-as-the-format; display belongs to
  the session, and print behavior keyed off frontmatter would surprise
  ("why did my report print in 16:9?").
- A separate Slides view alongside source/document: display is a flag
  on the existing document view, not a third view - one less view to
  keep in sync (toolbar, palette, beforeprint normalization).
- A dedicated slide file format or a layout engine: duplicates the
  document model and violates document-first.
- First H1 as presentation title, later H1s as slides: two meanings
  for one heading level; complicates the section browser, TOC and
  cross-references. One meaning for H1 (slide) is cleaner.
- Windowed slide rendering (off-screen slides removed from the DOM):
  conflicts with the DOM-as-source-of-truth editing model; all slides
  stay in the DOM and play mode is chrome over the full view.
