---
name: toolbar-context-first-contact
feature: toolbar-context
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review").
  - Click into the H1 heading; watch the block buttons.
  - Click into a normal paragraph; click into bold text.
  - Switch to Markdown view; put the caret on the "# Q3..." line,
    then on a plain line, then inside "**Midlands**".
  - With the caret on a plain source line, click the H1 button, then
    the P button.
  - Select a word in the source and click B twice.
  - Switch back to document view. Click into a normal paragraph and
    click the H1 button, then the P button. Press Enter at the end
    of the paragraph, type a line, and click the H2 button.
expected:
  - In document view, the H1/P button lights up for the block at the
    caret; B lights up inside bold text — but NOT on a heading line,
    where B is disabled (headings render bold yet carry no bold in
    the markdown).
  - In document view, the H1/P/H2 buttons CONVERT the caret's block
    (text preserved, outline updates); this works on a fresh
    Enter-created line too, not only pre-rendered blocks.
  - In Markdown view, the same buttons light up for the line prefix
    and the token at the caret; inline buttons are disabled on
    lines starting with "#".
  - In Markdown view, H1 prefixes the line with "# " and P removes
    it; B wraps the word in "**" and the second click removes it.
  - The rendered view reflects the edits after switching back.
---

# First-contact eval: toolbar context state

An agent playing a new user must see the toolbar reflect where they
are (both views) and be able to change block/inline formatting from
the toolbar while editing the Markdown source.
