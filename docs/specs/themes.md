# Themes

## Status: accepted (2026-10-20, ADR-0002's named references made
real; revised 2026-10-21: ten distinct looks, bundled faces, per-mode
colors)

## Decision

The frontmatter's `theme:` line references a theme by name. A theme
is a whole LOOK, not a font swap: a PRESET of typed theme values
(`THEME_PRESETS` in src/render/theme.ts) covering

- **typefaces**: text, title (h1), headings (h2-h6), and code, all
  bundled (ADR-0017), so a theme looks the same on every machine;
- **scale and rhythm**: body size, line height, measure (column
  width), h1/h2/h3 sizes;
- **heading treatment**: weight, tracking, h1 alignment
  (start/center), a rule above or below h2, and h3 as an uppercase
  or small-caps label;
- **text**: justified or ragged paragraphs, caption alignment and
  italics;
- **tables**: one of six table styles (below);
- **colors** for BOTH renditions: paper, ink, muted, heading,
  accent, rule, hairline, tint, plus a chart palette per mode. Dark
  mode re-dresses a document in its own theme's dark colors
  (docs/specs/dark-light-mode.md), so a dark Editorial page is
  still recognisably Editorial.

The document's own style keys override a theme KEY BY KEY (explicit
always wins). Unknown names fall back to the default look, because
a document may outlive a theme.

## Shipped themes

| Name | Label | Look |
|---|---|---|
| `default` | Folio | Source Serif throughout, booktabs, muted palette |
| `corporate-report` | Corporate report | Inter, navy headings with an underline rule, banded (filled) table header, corporate blues |
| `technical` | Technical | IBM Plex Sans, wide measure, uppercase h3 labels, full-grid tables, slate and teal |
| `editorial` | Editorial | Fraunces display over Literata text, warm off-white paper, rule above h2, minimal tables, italic captions, warm palette |
| `manuscript` | Manuscript | EB Garamond on cream, centered title, small-caps h3, narrow measure, sepia palette |
| `modern` | Modern | Space Grotesk headings, Inter text, striped tables, violet accent, vivid palette |
| `newsroom` | Newsroom | Heavy Libre Franklin heads, thick rule above h2, ledger tables, red accent |
| `elegant` | Elegant | Playfair Display over airy Inter, centered title, gold table rules, emerald and gold |
| `academic` | Academic | Justified Source Serif, compact heads, centered title, narrow measure, greyscale figures |
| `swiss` | Swiss | Bold Inter, oversized tight title, rules above h2, signal-red accent |
| `deck-clean` | Deck (light) | Light slide deck: Space Grotesk heads, striped tables, corporate blues, `slide.scale` 1.7 |
| `deck` | Deck (dark) | Dark slide deck: light ink on #14161c, uppercase h3 labels, ledger tables, centered titles |

## Slide keys (`slide.*`, docs/specs/slides.md)

Applied on top of ANY theme while the slideshow is playing (never
written to documents):

| Key | Values | Meaning |
|---|---|---|
| `slide.scale` | number (default 1.6) | multiplies the theme's type ramp for slides |
| `slide.aspect` | `16/9` (default) or `4/3` | slide aspect; also the print page size while playing |
| `slide.background.light` / `.dark` | color | solid deck background per rendition |
| `slide.valign` | `start` (default) or `center` | vertical placement of slide bodies |
| `slide.title` | `corner` (default) or `centered` | title-slide treatment |
| `slide.image.placement` | `above` (default) or `background` | image with content: stacks, or fills behind with scrim |
| `slide.image.width` | CSS length | contained image width on content slides |
| `slide.scrim.light` / `.dark` | color+alpha | legibility scrim under background images |

## Table styles (`table.style`)

| Style | Rendering |
|---|---|
| `booktabs` | heavy top and bottom rules, a light rule under the header |
| `plain` | full grid with a tinted header row |
| `striped` | header underline, alternating tinted rows |
| `minimal` | small uppercase muted header, hairlines between rows |
| `banded` | header filled with the accent color, hairline rows, accent bottom rule; in dark mode the band is the accent sunk into the paper, with heading ink. Hover and rename deepen the band rather than replacing it |
| `ledger` | thick top rule, uppercase header, a hairline under every row |

## Chart palettes (`chart.palette`)

`muted`, `corporate`, `ink`, `warm`, `sepia`, `vivid`, `news`,
`jewel`, `mono`, `swiss`. Each is hand-tuned for both papers: the
dark set uses the same hues, lighter and slightly less saturated,
never neon. There is no algorithmic "brightening".

## Switching

The document settings dialog opens on a **theme picker**: one card
per theme, previewing the theme's paper, title face and palette in
the current mode, with a one-line description. The palette command
**Change theme** opens the dialog with the picker focused. Picking
a card writes the `theme:` frontmatter line through the same
parse/serialize pipeline as editing the YAML by hand; Folio
(`default`) REMOVES the line.

Below the picker, the **Overrides** section shows the individual
style keys. Each "Theme default (...)" entry and size placeholder
names what the SELECTED theme gives. The section says how many keys
override the theme, and **Reset to theme** clears them all. An
override masks the theme, and a picker that silently changes
nothing was the original complaint.

## Acceptance

- Unit (`tests/render/theme.test.ts`): ten themes; themes name only
  bundled faces; ANY two themes differ on at least three visible
  axes (fonts, weight, table style, palette, paper, accent,
  alignment, rules, measure); every theme in BOTH modes clears
  contrast checks (ink and heading at least 7:1, muted and accent
  at least 4.5:1, every chart series at least 3:1 on its paper);
  style keys override key by key; unknown names fall back.
- e2e (`tests/e2e/settings.spec.ts`, "themes" describe): ten
  cards, with the document's theme checked; a card previews its
  face; picking Editorial on a bare document renders Literata 18px,
  updates the defaults, and writes `theme: editorial`; Folio
  removes the line while style keys survive; the override count and
  Reset to theme; the palette's Change theme focuses the picker.
- e2e (`tests/e2e/inspector.spec.ts`, "header legibility"): in
  every table style and both modes, a hovered or renamed header
  keeps at least 4.5:1 text contrast. This is the regression for
  banded headers going blank on click.
- First-contact eval: `evals/themes-first-contact.md`.
