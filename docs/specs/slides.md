# Slideshow (present a document as slides)

## Status: accepted (2026-10-31)

## Decision

Every folio document is and stays a plain Markdown document. There is
no slide mode in the file and no separate slides view: **you hit
play**. Play turns on slide rendering of the current document view -
one slide per H2 - and fullscreen; Esc (or the play button again)
turns both off. How the document displays is a property of the
session, not of the document - the file on disk never changes because
you presented it.

**H1 is the document title - invisible to the slideshow; every H2 is
a slide.** The H1 and anything under it before the first H2 are the
deck's front matter: presenter instructions, deck-level notes, shown
in document view and hidden while playing. This matches the rest of
folio (a lone H1 is the title in the contents list and names the
file), so nothing is special-cased: slides are H2 sections.

## Why this fits folio

- Page breaks on headings already exist as a style, not content:
  `pagebreak.h1` / `pagebreak.h2` (docs/specs/document-settings.md)
  emit `break-before: page` in paged media today. A slide is the same
  H1 boundary made visible on screen while slide rendering is on.
- All aesthetics live in themes (ADR-0002, docs/specs/themes.md):
  the new `slide.*` keys apply on top of ANY theme while slide
  rendering is on, so every existing theme can present. Dedicated
  deck themes are new presets in `THEME_PRESETS`
  (src/render/theme.ts) - e.g. a dark `deck` theme (dark paper via
  `slide.background`, light scrim, vivid palette) and a light
  `deck-clean` - picked with the same theme picker as reports. A deck
  theme is a whole look; the `slide.*` keys just make slide rendering
  legible on any look. Documents stay semantic; no inline styling,
  non-negotiable #1 intact - and no new frontmatter keys.
- Data flows into slides unchanged: tables are typed datasets and
  charts are queries over them (ADR-0003, ADR-0004), rendered as
  vector SVG that prints crisp; compute blocks (ADR-0030) cover the
  "run it through code" case.
- Export reuses one pipeline: printing while slide rendering is on
  uses `@page { size: 16in 9in }` with `break-before: page` on H1s -
  one slide per PDF page, the same thing PowerPoint's own
  "Save as PDF" produces (docs/specs/print.md, ADR-0025).

## Contract

- **Model**: nothing. No frontmatter key, no new block kinds, no
  page-break token in content. The block schema and the golden
  round-trip tests (tests/golden/) are untouched by construction.
  Whether a document is being shown as a deck is decided at play
  time, by the user pressing play - never stored in the file.
- **Slide structure (slide rendering on)**: each H2 starts a slide
  (wrapped in a presentational `.folio-slide` div - `display:
  contents` otherwise, and `syncFromDom` reads through it, so the
  model and the Markdown are untouched); the H2 text is the slide
  title; everything until the next H2 is the slide body. H3-H6 are
  in-slide headings. The H1 and its preamble are the deck's front
  matter, hidden while playing. The contents list is unchanged (a
  lone H1 is the title in every view).
- **Views**: two views as today - Markdown source and document
  (src/main.ts `btnView`/`btnMd`) - plus a **slide-rendering flag** on
  the document view that play toggles. The flag only changes styling:
  every slide stays in the article's DOM at once, so WYSIWYG editing
  works exactly as in document view - `syncFromDom` (src/component.ts)
  rebuilds the model from the whole article either way. The one hard
  rule is **no windowing**: slides are never removed from the DOM for
  being off-screen. That is the fatal complication
  docs/specs/section-windowing.md identifies - a partial DOM would
  make structural sync silently delete unrendered blocks.
- **Entry points**: a play button in the toolbar and palette commands
  "Play slideshow" (slide rendering + fullscreen; arrow keys / click
  advance, Esc exits both) and "Stop slideshow". Like the
  source/document toggle, this is session state and is never written
  to the file.
- **Slide rendering (theme-driven)**: a slide is a full-viewport page
  (`aspect-ratio` from the theme's `slide.aspect`, default `16/9`;
  `4/3` is a valid theme value), scaled to fit, with the H1 as its title and
  the body flowed under it.
- **Slide typography is a scale, not new sizes**: the theme's normal
  type ramp (body size, line height, h1-h3 sizes) is multiplied by a
  single `slide.scale` factor (closed schema key, theme value, e.g.
  1.6) so a book-body 11pt reads as slide-body ~18pt. The document's
  own `body.font.size` etc. still apply as the base; slide rendering
  only scales. `slide.title.size` / `slide.body.size` may override the
  scaled h1 / body for a given theme, but defaults are derived from
  the ramp x scale, never absolute literals.
- **Per-block slide rules** (theme decisions, applied only while slide
  rendering is on): bullets render as slide bullets (larger markers,
  looser leading); a blockquote is a pull-quote; tables and charts
  render at slide scale (figure max-width = slide width minus
  padding), captions stay with their figure; code/math blocks render
  at body scale, not scaled up. Values live in themes, never in the
  document.
- **Speaker notes** (v2): a trailing blockquote on a slide is its
  speaker note. The main display NEVER shows it while playing (the
  PowerPoint presenter rule - notes are for the presenter, not the
  projector); N or the palette's "Toggle speaker notes" shows them.
  Notes are `display: none` in print media always. A `>`-led prose
  block renders as `<blockquote>` (and syncs back with the marker, so
  the source round-trips).
- **Images on slides** (`slide.image.placement`, theme key, default
  `above`): an image block **alone** on a slide always renders
  full-bleed - the divider/background slide. An image **with other
  content** on the slide either stacks above the text, contained at
  `slide.image.width` (`above`), or fills the slide as a background
  with the content overlaid (`background`, `object-fit: cover`) -
  the common PowerPoint look. `background` applies a legibility scrim
  from the theme (`slide.scrim`, a color + opacity per mode, default
  a soft dark scrim in light mode / light scrim in dark) under the
  text. Which placement a deck uses is a theme decision; the document
  only supplies blocks.
- **Slide composition (theme-driven, per-deck not per-slide)**:
  - `slide.valign: start | center` (default `start`) - vertical
    placement of the slide body. A slide whose body is a single
    sentence, a single blockquote (pull-quote), or empty (a pure
    title slide) centers automatically regardless of the key;
    `center` centers all slides in the deck.
  - `slide.title: corner | centered` (default `corner`) - a pure
    title slide (H1 + at most one short paragraph) centers the H1 as
    a title-slide title in `centered` themes.
  - Slides are single-column: content never splits into regions
    (image left, text right is out of scope, below). The one
    exception is `slide.image.placement: background`, where the image
    is behind the single column of content, not beside it.
  - All composition keys live in the theme; the document only ever
    supplies blocks, so two decks on the same theme look consistent
    and a deck never carries layout literals (ADR-0002).
- **Backgrounds**: whole-deck background comes from the theme
  (`slide.background`, a solid color per mode - dark deck themes
  included; dark mode already re-dresses per theme). Per-slide
  background COLOR is not expressible - it would be inline styling
  (ADR-0002). A per-slide photographic background is the image rules
  above: image-only slide (full-bleed) or `slide.image.placement:
  background` (cover + scrim). Gradients/patterns are not in the
  closed schema.
- **Overflow policy**: a slide does not flow to a second page on
  screen; `slide.scale` plus the slide rules above set the type scale
  and the view clips/warns. The
  component measures overflow (slide scrollHeight vs slide height) and
  reports it to the host as an attribute (e.g. `slides="overflow"`,
  alongside the existing `mode` attribute read at src/component.ts);
  the host renders the "slide overflows" marker in the status bar.
  Auto-splitting a slide into two is NOT in this proposal.
- **Navigation**: arrow keys / click advance while playing; the
  section browser lists slides; a slide counter "n of N" in the status
  bar while slide rendering is on. Edge cases: advancing past the
  last slide clamps (stays on the last slide); deleting the current
  H1 mid-play moves to the slide now at that position; a 10k-H1
  document gets no per-slide rendering work beyond the CSS already
  applied to every block.
- **Play vs. edit**: while playing, the document view is still
  contenteditable, but arrow keys / click advance slides instead of
  moving the caret; clicking into text places the caret and typing
  works as in document view. Play is a display flag, not a lock.
- **Discoverability (ADR-0009 layer 1)**: the play button sits in the
  toolbar next to the view toggle, with palette commands "Play
  slideshow" / "Stop slideshow" and matching in-app-help entries in
  the same commit; a document with two or more H1s surfaces a
  "Play as slides" hint in the empty/status area. The first-contact
  eval must complete "present this document" with no instructions.
- **Paper size is a style key, not a constant**: new closed style key
  `page.size` (ADR-0002 schema change, typed values such as `a4` |
  `letter` | `a5` | `16:9` | `4:3`; no key means the theme's
  `pageSize` - `a4` for report themes, `16:9` for the deck themes),
  with a typed dropdown
  in the settings dialog alongside the existing `pagebreak.h1` /
  `page.numbers` controls (fillSettings, src/main.ts:3483). Today
  the size is
  hard-coded in three places - the print stylesheet's `@page`
  (index.html:1400), the desktop `export_pdf` PageSetup
  (apps/desktop/src-tauri/src/lib.rs), and the furniture stamper's
  fallback (apps/desktop/src-tauri/src/pdf_furniture.rs) - and all
  three read the key instead: the stylesheet emits
  `@page { size: <value> }`, and the desktop export passes the value
  through the same `furniture` payload it already takes. A raw
  Markdown file with no key assumes the THEME's default paper
  (`a4` for report themes; the `deck`/`deck-clean` slide themes
  default to `16:9`, so a deck prints/exports as slides even without
  playing).
- **Print / export**: while slide rendering is on (or while playing),
  the effective `page.size` is the slide aspect (`16:9` unless the
  theme's `slide.aspect` says otherwise) - play sets it for the
  session, the file is unchanged. Printing and "Export ▾ as PDF"
  (docs/specs/print.md) then paginate one slide per page via
  `break-before: page` on H1s. H1s always break in paged output while
  slide rendering is on, whether or not the document sets
  `pagebreak.h1: before` (which stays meaningful only for reports);
  `page.numbers` / `page.header` furniture is suppressed on slides.
  The existing `beforeprint` normalization (src/main.ts
  `preparePrint`) already switches out of source view and exits
  fullscreen, and gains one step: slide rendering stays on if it was
  on. With slide rendering off, printing is unchanged: continuous
  paper at the document's `page.size` (default A4). Page size follows
  style + session, never a hard-coded constant.
- **Per AGENTS.md**, shipping this requires, all in the same commit:
  palette entries ("Play slideshow" / "Stop slideshow"), an in-app-help
  topic (`demo/help/slides.md`, listed in demo/help/index.md - help is
  folio documents per docs/specs/in-app-help.md), the toolbar play
  button, a first-contact eval (`evals/slides-first-contact.md`), unit
  + e2e + golden-style tests, and this spec moved to accepted.

## Deliberately out of scope

- A layout engine. CSS paged media plus theme policy does the work;
  what remains (two-column slide layouts, speaker notes) is deferred.
- Two-column or multi-region slide layouts (would need new block
  kinds - the closed block schema changes only with its own ADR).
- Speaker notes as a first-class block (a trailing blockquote rendered
  only while playing is a possible later addition).
- Windowed/lazy rendering of slides (off-screen slides removed from
  the DOM): breaks the DOM-is-source-of-truth editing model; see
  docs/specs/section-windowing.md. All slides stay in the DOM.
- A separate Slides view, or a `mode: slides` frontmatter key, or any
  document-level slide marker: display is the session's business, not
  the file's.
- Live presenter view / remote control.

## Acceptance (when implemented)

- Unit: `tests/engine/doc.test.ts` unchanged (no model change);
  `tests/render/theme.test.ts` (slide theme keys resolve while slide
  rendering is on and fall back like any theme key).
- Golden-style: a small deck fixture rendered with slide rendering
  on and off serializes byte-identically - the load-bearing invariant
  that play never touches the model.
- e2e: `tests/e2e/slides.spec.ts` (play toggles slide rendering and
  fullscreen; one slide per H2; the H1/preamble hide while playing;
  notes toggle and never print; editing inside a slide keeps the
  model intact; the shipped deck example plays; navigation and
  counter; print media while playing uses 16:9 pages; print with
  slide rendering off stays A4; export produces the deck PDF; the
  saved file is byte-identical before and after playing).
- Eval: `evals/slides-first-contact.md`.
