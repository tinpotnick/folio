---
name: comments-first-contact
feature: comments (docs/specs/comments.md)
steps:
  - Open an example, select a sentence, and add a comment to it without knowing any syntax.
  - Type the comment in the box that appears; watch the selected sentence highlight.
  - Resolve the comment, then reopen it, then delete it - each from where it is shown or with Ctrl+K.
  - Look at the Markdown view.
expected:
  - The comment is found via Ctrl+K "comment" (or the palette entry "Add a comment").
  - The selected sentence is quoted in the comment and highlighted in the document; the caret lands in the comment body.
  - The Markdown view shows a `::: comment {#c-1}` block with anchor, quote, author and the text - the file stays plain Markdown.
  - Resolve dims the comment and writes `resolved: true`; Delete removes the block. Both are also reachable by searching "comment" in Ctrl+K.
---

# First-contact eval: comments

A new user comments on a sentence, resolves and deletes the comment
using only visible affordances, and the file stays semantic Markdown.
