# Flashcard deck mock-ups (design exploration, not wired up)

Static mock-ups of a proposed `::: flashcards` block for folio, rendered
with the real default theme palettes (`src/render/theme.ts`, light and
dark), the bundled Source Serif 4 / Inter faces, and Noto Naskh Arabic
for the card text (Arabic shaping is real, via HarfBuzz). These are
throwaway design artifacts for discussion — nothing here is referenced
by the app.

- `edit-deck.png` — document view: the deck as a figure with label strip
  ("Food & animals", due badge), the uniform inspector bar (deck title,
  Study deck, Shuffle), and card rows (front → back, per-card play /
  record / delete), plus an add-card row. Sits next to a `::: audio`
  figure to show the two coexisting.
- `study-flip-front.png` / `study-flip-back.png` — study mode, flip
  card: big Arabic word + round play button; flipped state shows the
  translation and four spaced-repetition grade buttons (Again/Hard/
  Good/Easy with intervals). SRS state itself would live in localStorage
  keyed by doc + deck + card hash + author, never in the Markdown.
- `study-match.png` / `study-match-dark.png` — Duolingo-style match mode
  in light and dark: audio tiles left, word tiles right, one pair matched
  (green + check), one clip selected (accent ring), one wrong pick (red).
- `study-mcq.png` — multiple choice: prompt card with play button, 2×2
  options drawn from the same deck, number-key chips, correct/wrong
  feedback states.

All colors come from `--folio-*` theme variables (the `flashcard.*` theme
keys proposed in the spec discussion); layout/interaction would live in
the component. Regenerate with `node gen-mockups.mjs` in this directory
(needs `npm i @resvg/resvg-js` plus the woff2→ttf conversions noted in
the script header; fonts come from the repo's own `@fontsource-*`
deps, Noto Naskh Arabic from `@fontsource/noto-naskh-arabic`).
