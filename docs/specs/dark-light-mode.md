# Dark and light mode

## Status: accepted (2026-10-20; revised 2026-10-21: the dark
rendition belongs to the theme)

## Decision

Dark mode dresses EVERYTHING: the app chrome (toolbar, section
browser, Markdown source editor, status bar, modals) AND the
document's RENDITION, because a white slab on a dark app is glare.
The document's THEME (its serialized look, closed schema, ADR-0002)
never changes; the dark page is a presentation of that theme,
exactly like print. And it is the THEME'S OWN dark: every theme
carries hand-picked dark colors and a dark chart palette
(docs/specs/themes.md), so a dark Manuscript page is warm
brown-black with cream ink and a dark Corporate report is deep
navy-slate. There is no single generic dark for every document.

The chrome's dark is quiet neutral graphite: no blue cast, no pure
black or white, one restrained accent.

## Contract

- **One switch, three entry points**: the moon button beside
  Help, the palette command "Toggle dark mode", and the persisted
  choice. `document.documentElement.dataset.mode` holds `light` or
  `dark`.
- **Before first paint**: a tiny `<head>` script sets the
  attribute from localStorage (`folio:mode`), falling back to the
  system `prefers-color-scheme`, so users who prefer dark never see
  a flash of light.
- **Chrome**: every chrome color is a custom property on `:root`,
  overridden by `html[data-mode="dark"]`: surfaces, text, borders,
  the accent pair, the Markdown syntax palette, the record pulse.
  `color-scheme` follows, so native controls and scrollbars match.
- **The document**: the component takes the mode as an ATTRIBUTE,
  `<folio-doc mode="dark">`. Anything else, or no attribute, is
  light, so any host (or none) gets the light rendition. The host
  sets the attribute on every `<folio-doc>` (the document and the
  help window). The component emits the theme's colors for that mode
  as `--folio-*` custom properties on `:host`. A host may still
  override any of them from outside (`folio-doc { --folio-paper:
  ... }` beats `:host`).
- **In-place re-dress**: a mode change swaps the theme stylesheet
  and re-paints the figures that bake colors in: charts (series,
  ticks, grid, pie seams and the donut hole take the theme's
  per-mode palette and ink) and diagrams (mermaid's `base` theme
  fed the page's fonts and colors, no drop shadow). It does NOT
  re-render the document, so the caret, scroll, and any open
  inspector survive.
- **The page**: the document is a page on the app's desk. The
  component owns the paper and exposes `--folio-page-padding`,
  `--folio-page-radius`, and `--folio-page-shadow` (all off by
  default); the demo host sets margins and a subtle lift that suits
  each mode, so tinted or dark paper never runs text into its edge.
- **Editing chrome inside the document** (inspector bars, menus,
  the dataset browser, code syntax colors) follows the MODE, not
  the theme. It is app furniture, shared by every theme.
- **Print stays light**: whatever the app mode, print uses the
  light rendition on white paper (the print stylesheet re-pins the
  light variables).
- **The button says which way it goes**: "Switch to dark mode" /
  "Switch to light mode" (title and aria-label swap with the
  mode).

## Acceptance

- e2e: `tests/e2e/mode.spec.ts`: defaults to light, the button
  flips, the choice persists across reloads, the palette entry
  works. In dark mode the sample (corporate-report) wears THAT
  theme's dark paper, ink, chart ticks and series, and the article
  element survives the switch (no re-render). Light mode draws the
  theme's palette verbatim.
- Unit: `tests/render/theme.test.ts` (the mode picks the theme's
  colors; print re-pins the light rendition; every theme clears
  the contrast checks in both modes).
- First-contact eval: `evals/dark-light-first-contact.md`.
