# Comments and review

- **Add a comment** adds a comment where your cursor is - from
  Ctrl+K ("comment"), from **Insert › Comment** in the toolbar, or by
  right-clicking (the document's context menu). If you selected text
  first, the selection is quoted and highlighted in the document, and
  the comment anchors to it. Type the comment in the box that appears.
- **Set comment author** (Ctrl+K "author", the right-click menu's
  "Set comment author", or click the name on any comment) sets the
  name stamped on your comments. It is remembered on this device,
  written into each comment in the file, and saving a new name also
  renames your existing comments in the open document. The first
  comment you add asks for it in the same dialog.
- Comments are part of the document: a `::: comment` block in the
  Markdown view, so they travel with the file, diff in git, and render
  offline like everything else.
- **Resolve comment** marks the clicked comment done (it stays in the
  document, dimmed); **Reopen** on it undoes that. **Delete comment**
  removes it. All three act on the comment you last clicked.
- Click a highlighted quote to jump to its comment. Comments do not
  print.
- Replies: add another comment on the same text - in the Markdown view
  set `in-reply-to: @c-1` on the reply block to thread it under the
  first comment.
