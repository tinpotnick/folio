---
name: proofing-first-contact
feature: proofing (bundled spell + grammar, ADR-0033)
steps:
  - Start the demo host: read the welcome guide's Getting started
    steps, and open Help (F1) and read its index - without searching,
    just browsing.
  - Then open a document, switch to the Markdown view and replace the
    body with a paragraph containing "wordd" and "teh", back in the
    document view.
  - Right-click the "wordd" squiggle in the paragraph.
  - In the menu, click the "word" suggestion.
  - Right-click the "teh" squiggle and click "Add ... to dictionary".
  - Press Ctrl+K, type "grammar", press Enter.
  - Type "I saw the the dog." into the paragraph.
  - Right-click the "the the" grammar underline and click the first
    suggestion.
  - Press Ctrl+K, type "spell check", press Enter.
  - Switch to the Markdown source view (toolbar toggle) and observe the
    source; right-click the "teh" underline there and pick a suggestion.
expected:
  - Browsing alone surfaces proofing: the welcome guide's Getting
    started has a "Proofread as you write" step, and the help index
    lists "Headings, links and proofing" - both pointing at the
    bundled spell check (on by default) and Ctrl+K "grammar" for the
    opt-in grammar check.
  - Misspelled words in prose show a wavy red underline without the
    browser's own native squiggles (the bundled checker owns them);
    the Markdown source still contains the original misspelled words
    - the marks are view-only.
  - The right-click menu on a misspelled word is labelled "Spelling",
    lists suggestions first, then "Add ... to dictionary"; picking
    "word" rewrites the paragraph (and the source) to "word", and the
    squiggle disappears.
  - "Add to dictionary" clears the "teh" squiggle and the word stays;
    it persists (localStorage) across reloads.
  - The palette's "Check grammar with Harper" command turns grammar
    check on (its engine loads once from the app's own assets, fully
    offline); "the the" gets a wavy accent underline while the source
    keeps the repeated word.
  - Right-clicking the grammar mark opens a menu labelled "Grammar"
    whose first suggestion rewrites "I saw the the dog." to "I saw the
    dog." in view and source, and the mark disappears.
  - The palette's "Turn spell check off" removes all squiggles (the
    words stay); running it again brings them back.
  - In the Markdown source view, misspelled words are underlined in the
    colored source too - but only in prose: code spans, fenced code and
    ::: directive blocks stay clean - and the source text itself still
    contains the misspelling (marks are view-only). Right-clicking a
    marked word there opens the same "Spelling" menu, and picking a
    suggestion rewrites the source (it lands in the document when you
    switch back).
---
