---

name: flashcards-first-contact
feature: flashcard decks (docs/specs/flashcards.md)
steps:

- Start the demo host, open the Insert menu, and click Flashcards.
- Click the deck's label strip; in the inspector bar set the title
  to "Animals".
- Edit the starter card to front "perro", back "dog"; click
  "+ Add card" and add "gato" / "cat" and "casa" / "house".
- On the "perro" row, click the mic button, speak, click it again
  (grant microphone permission when asked).
- Click the deck label, then "Study deck"; press Space to flip,
  press 3 (Good), then Esc.
- In the study header switch to Match, press a prompt, then its
  word; switch to Choice, press 1; Esc out.
- Switch to Markdown view and read the deck's directive; switch
  back. Click the deck once and press Backspace.
  expected:
- A deck figure appears at the caret with one editable row; the
  inspector bar reveals on click inside the deck and hides on a
  click outside; the title shows in the label strip.
- Rows edit in place and reach the Markdown source as
  `card: "perro" | "dog" | data:audio/...` lines under
  `::: flashcards {#deck-1}` with `title: "Animals"`.
- Recording pulses the row button and counts in the status bar;
  stopping embeds the clip on the card and the row's button becomes
  a play button.
- Study mode swaps the rows for the study card (the file does not
  change); flip shows the back with four grade buttons; grading
  drops the label badge from "3 due" to "2 due"; Match locks a
  correct pair green and flashes a wrong pick red; Choice marks the
  picked option; Esc returns to the edit rows.
- The Markdown source is unchanged by studying (no study state in
  the file), and Backspace on the selected deck removes the block
  from both the view and the source.
