---
name: lists-first-contact
feature: lists (docs/specs/lists.md)
steps:
  - Start the demo host. Click at the end of any paragraph on the
    welcome page, press Enter, and make a three-point bulleted list
    without reading any docs.
  - Turn it into a numbered list, then back into a paragraph.
  - Make a new list by typing "- " at the start of an empty line.
  - End the list and carry on writing a paragraph.
  - Make a three-item list, then make the middle item a sub-item of
    the first, then move it back out.
  - Under a numbered item, make a bulleted sub-list.
  - Open the Markdown source.
expected:
  - The user finds a list affordance by looking (the list buttons
    beside P) or by searching the palette for "list", "bullet" or
    "numbered".
  - Enter adds an item; Enter on an empty item leaves the list.
  - "- " typed at the start of a line becomes a bullet.
  - Tab nests an item (Shift+Tab lifts it), or the user finds
    "indent" / "outdent" in the palette; typing continues in place.
  - A bulleted sub-list sits under a numbered item.
  - The source shows plain `- item` / `1. item` lines, nested by
    indentation.
---
