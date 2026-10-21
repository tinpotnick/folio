---
name: paragraph-editing-first-contact
feature: editor-paragraphs
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations").
  - Click into the last paragraph, press Enter, and type — no click
    in between.
  - Click into the middle of a paragraph, press Enter to split it,
    then Backspace to merge it back.
  - Press Enter twice from the end of a paragraph to create two
    empty paragraphs; switch to Markdown view and back.
  - Click into a table cell, edit a number and press Tab; then
    click into a paragraph and press Enter.
expected:
  - After Enter, the caret is already on the new line and typing
    lands there (word-processor behavior).
  - The split and merge restore the original text exactly; the
    Markdown source reflects the split without a view switch.
  - The two empty paragraphs are still there after the Markdown
    round-trip (empty blocks serialize as blank-line runs).
  - Enter in the paragraph after using the table splits the
    paragraph — the table does NOT grow a row.
---
