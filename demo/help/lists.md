# Lists

- Start a line with `- ` for a bulleted list or `1. ` for a numbered
  one, in a new paragraph or in the source. The **Bulleted list** and
  **Numbered list** buttons (beside the text style menu, or search "list" in the
  palette) turn the paragraph at the caret into a list, switch
  between the two kinds, and turn a list back into a paragraph.
- **Enter** adds an item; **Enter** on an empty item ends the list.
  Pressing the same list button again (or **Paragraph** in the text style menu, or searching
  "paragraph" in the palette) turns each item back into its own
  paragraph.
  Items take bold, italic, code and links like any paragraph.
- **Tab** nests an item under the one above it; **Shift+Tab** lifts
  it back out, and on a top-level item turns it into a normal
  paragraph (or search "indent" / "outdent" in the palette).
  **Backspace** at the start of an item does the same step back
  before it joins any lines. A
  nested list can be bulleted inside a numbered one, or the other way
  round: with the caret in the sub-list, press the Bulleted or
  Numbered list button (it changes just that sub-list), or type
  `- ` / `1. ` in an empty item. In the source, nesting is indentation, the standard
  Markdown way: an item indented under the one above (two spaces
  under `- `, three under `1. `) is its sub-item.
- Numbered lists number themselves when saved. **Enter** on an empty
  nested item lifts it one level; on an empty top-level item it ends
  the list.
