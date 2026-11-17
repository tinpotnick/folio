# Themes

- A theme changes the whole look at once: fonts, heading style,
  table style, colors, and chart palette, in light AND dark mode.
  Search "theme" in the palette (**Change theme**), or open the
  document settings (sliders icon) and pick a card: Folio,
  Corporate report, Technical, Editorial, Manuscript, Modern,
  Newsroom, Elegant, Academic, Swiss. Each card previews its paper,
  title face, and colors.
- Picking one writes the `theme:` line at the top of the source.
- Individual settings below the cards still override the theme,
  key by key. Overridden fields are marked, the dialog counts
  them, and **Reset to theme** clears them all.
- Style keys in the source's `style:` header dress the document
  further: `figure.image.layout: float-left` (or `float-right`)
  makes image figures float so text wraps around them, with
  `figure.image.width` (e.g. `40%`) sizing them and
  `figure.image.align` placing block images. These apply to every
  image in the document at once.
