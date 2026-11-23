# Flashcard decks

## Status: proposed (mock-ups: docs/mockups/flashcards/, PR #182)

## Decision

A flashcard deck is a FIGURE block - the study sibling of the audio
embed: recorded media in, practice out, never execution. It serializes
as a directive, renders as a `contentEditable="false"` figure, and
carries the uniform inspector contract (reveal on click inside,
hide on any click outside, Esc dismisses, no close button).

```
::: flashcards {#spanish-vocab}
title: "Spanish pronunciation"
card: "perro" | "dog" | @perro-clip
card: "gato" | "cat"
:::
```

- **Keys**: `title` (quoted, optional) and one `card:` line per card.
  A card is `card: "front" | "back" | sound` - front and back are
  quoted (a `|` inside quotes does not split; `\"` escapes a quote);
  the back field's PRESENCE is what round-trips (`card: "a"` and
  `card: "a" | ""` are distinct and both byte-stable). `sound` is raw:
  an `@audio-id` reference to an audio block in the same document
  (record once, reference from many cards - the `@fig:id` cross-ref
  pattern) or a data URI recorded straight onto the card. An empty
  front is a parse error (it would not survive a reload). Unknown
  keys are a parse error, like every directive.
- **Model**: `{ kind: "flashcards", flashcards: Flashcards }` in
  `src/engine/doc.ts`; `Flashcards` mirrors `Audio` in
  `src/engine/index.ts` (`id`, `title?`, `cards: Flashcard[]`,
  `Flashcard = { front, back?, sound? }`). Classified `"figure"` in
  `BLOCK_CLASS` - a compile error if forgotten - so Enter at its
  edge, ArrowDown past a trailing one, click-below, and Backspace/
  Delete on the selected figure all come from the one `isFigureBlock`
  predicate (docs/specs/block-schema.md).
- **Offline / size**: a card's inline sound is a data URI under the
  same 8 MB ceiling as images/audio (`MAX_EMBED_BYTES`); `@ref` sounds
  cost nothing extra.
- **Edit view**: the figure shows a label strip (cards icon, title,
  card count, due badge) above a `.folio-fc-body` of card rows -
  front input, `→`, back input, play/record button, delete button -
  plus a dashed "Add card" row. Inputs are model writes on
  change/Enter (clearing the front removes the card, since an empty
  front is not parseable); add/delete re-render. The mic button
  records via `getUserMedia` + `MediaRecorder` (browser APIs,
  ADR-0007) with the same 3-minute auto-stop and status countdown as
  the toolbar's record button; the clip lands as a data URI on the
  card. A card with a sound gets a play button (Alt-click
  re-records). The inspector bar carries the deck title and a
  **Study deck** button.
- **Study mode is a session flag, never in the file** - the slideshow's
  rule (docs/specs/slides.md): while studying, the deck figure renders
  the study UI instead of the rows (same DOM node; the rows stay
  underneath and print). Three modes, switchable in the study header:
  - **Flip** - front (big, with play button if the card has a sound),
    Space flips to the back; on the back, Again/Hard/Good/Easy grade
    (keys 1-4), arrows navigate, Space next.
  - **Match** - the Duolingo flow: left column prompts (an audio tile
    if the card has a sound, else its back text), right column the
    front words, independently shuffled. Press a prompt (plays the
    clip), then its word: a correct pair locks with the theme's ok
    color and a check; a wrong pick flashes the bad color and
    deselects. Progress "n of N matched", Shuffle re-deals.
  - **Choice** - prompt card (play + front word) with four options
    drawn from the SAME deck (so distractors are plausible), keys
    1-4, ok/bad feedback, Space next.
    Esc exits; Backspace in study mode never deletes the deck. All keys
    are handled on the study root (the figure is not editable, so that
    is the only key path while studying) and stopPropagation keeps them
    from reaching document-level handlers.
- **Spaced repetition is app state, never document state**: grades
  are SM-2 (ease + ms interval) stored in localStorage
  (`src/srs.ts`, key `folio-flash-srs`) keyed by document identity +
  deck id + card CONTENT HASH + local author name (`folio-author`,
  the comment author). A teacher/student file round-trips
  byte-identically and each user keeps private progress; editing a
  card changes its hash, resetting that card's schedule (correct -
  the card changed). The label strip's badge is computed, never
  stored: "N due" / "all done".
- **Theme closure**: the deck's look is new typed `flashcard.*` theme
  keys (`FlashcardTheme` in src/render/theme.ts: radius, ok/okBg/
  okBorder, bad/badBg/badBorder per mode), emitted as `--folio-fc-*`
  variables by `flashcardCss()`; every component color reads those
  variables, so all themes + dark mode restyle the deck and no style
  literal ever enters a document (ADR-0002). The component carries
  layout and interaction only. `prefers-reduced-motion` disables the
  shake/pulse. Card text gets `unicode-bidi: plaintext` like other
  text blocks, so Arabic/Hebrew cards auto-detect direction
  (docs/specs/bidi-typography.md).
- **Insert**: the insert menu's Media group gains a Flashcards button
  and the palette gains "Insert a flashcard deck" (appends a deck with
  one starter card after the caret's block; without focus, at the
  end) - same contract as the other insert commands. In-app help:
  demo/help/flashcards.md, listed in demo/help/index.md.
- **Print**: the study UI never prints; the deck prints as its card
  rows (the label strip keeps title and count).
- **Source view**: the directive lines highlight as generic
  `directive` tokens, like `::: audio`.

## Acceptance

- Engine: `tests/engine/doc.test.ts` ("flashcards blocks": parse,
  byte-identity incl. empty-back and front-only cards, quoted pipes,
  escaped quotes, data-URI sound, unknown keys, empty front, coexistence
  with prose/audio) and `tests/golden/flashcards.md` round-trip.
- e2e (Chromium): `tests/e2e/flashcards.spec.ts` - hand-typed directive
  renders rows and round-trips; insert-menu deck; in-place card edit
  reaches the source; inspector title + add/delete; Backspace removal;
  study flip/grade (due badge drops, file unchanged, Esc exits);
  match correct/wrong; choice keys; `@audio-id` card sound.
- WebKitGTK: `tests/webkitgtk/flashcards-native.js` (figure selected,
  real Backspace removes the deck; rows are not an editing surface).
- First-contact eval: `evals/flashcards-first-contact.md`.
- Help topics round-trip: `tests/engine/help-topics.test.ts`.
