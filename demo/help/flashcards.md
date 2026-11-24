# Flashcard decks

- A **flashcard deck** is a `::: flashcards {#id}` block: one `card:`
  line per card, `card: "front" | "back" | sound`, and an optional
  `title:`. Insert one with **+ Insert › Flashcards** or the palette's
  **Insert a flashcard deck**; hand-typing the directive works too. In
  the document view the deck shows its cards as rows - edit the front
  or back text in place, **+ Add card** appends a row, the × button
  deletes a card, and clicking a deck once + Backspace/Delete removes
  the whole deck. Click the deck's label strip for the inspector bar:
  edit the deck title, or press **Study deck**.
- A card's **sound** is the third field: `@some-audio-block` references
  an audio clip recorded elsewhere in the document (record once,
  reference from many cards), or a data URI. The mic button on a card
  with no sound records straight onto that card (the same 3-minute /
  8 MB limits as toolbar recording); a card with a sound gets a play
  button (Alt-click re-records).
- **Study mode** is a session view - like presenting slides, it never
  changes the file. While studying, the deck offers three modes:
  **Flip** (Space flips, arrows move, 1–4 grade Again/Hard/Good/Easy),
  **Match** (the Duolingo flow: press a clip in the Listen column, then
  its word in the Match column), and **Choice** (multiple choice,
  options drawn from the same deck, keys 1–4). A deck whose cards all
  have sounds opens in Match by default. While studying, Space works
  wherever you last clicked inside the deck - and only the deck's label
  strip opens the inspector bar, so studying never shifts the card out
  of view. Esc exits. Grading is spaced repetition:
  progress is kept per author in the browser's local storage (keyed by
  document, deck, and card content), never in the Markdown - the label
  strip's badge shows how many cards are due.
- Decks print as their card list; the study UI never prints.
