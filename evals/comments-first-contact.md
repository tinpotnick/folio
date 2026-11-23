---
name: comments-first-contact
feature: comments (docs/specs/comments.md)
steps:
  - Open an example, select a sentence, and add a comment to it without knowing any syntax - try each way: Ctrl+K "comment", Insert › Comment, and right-click.
  - With no author name set yet, the author dialog appears first: type a name and Save; then add the comment.
  - Set a different author via Ctrl+K "author" and again by clicking the name on the comment; add another comment to see the new name.
  - Type the comment in the box that appears; watch the selected sentence highlight.
  - Resolve the comment, then reopen it, then delete it - each from where it is shown or with Ctrl+K.
  - Look at the Markdown view.
expected:
  - The comment is found via Ctrl+K "comment", the Insert menu, or the right-click context menu (all three land on "Add a comment").
  - The author dialog appears on the first comment when no name is stored; "Set comment author" (Ctrl+K "author", the right-click menu, or clicking the comment's author name) opens the same dialog, prefilled. Saving remembers the name on this device and stamps it on new comments.
  - The selected sentence is quoted in the comment and highlighted in the document; the caret lands in the comment body.
  - The Markdown view shows a `::: comment {#c-1}` block with anchor, quote, author and the text - the file stays plain Markdown.
  - Resolve dims the comment and writes `resolved: true`; Delete removes the block. Both are also reachable by searching "comment" in Ctrl+K.
---

# First-contact eval: comments

A new user comments on a sentence, resolves and deletes the comment
using only visible affordances, and the file stays semantic Markdown.
