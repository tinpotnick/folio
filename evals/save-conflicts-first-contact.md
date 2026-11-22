---
name: save-conflicts-first-contact
feature: save-time conflict detection (docs/specs/save-conflicts.md)
steps:
  - Open a document from disk (desktop app, or the web with a real file), save it once so folio knows the file.
  - Change the file outside folio (another editor, a synced folder) in a different part of the document than your own open edit.
  - Save in folio and read the status line.
  - Repeat with both sides editing the same line; in the dialog, pick a side per hunk, try Save merged, Overwrite with mine, and Cancel.
expected:
  - A clean merge saves both changes and says so ("Merged outside changes - saved ..."); no dialog blocks the save.
  - A real conflict opens the "Changed on disk" dialog listing each hunk with yours vs on disk; Save merged applies the picks, Overwrite keeps only yours, Cancel writes nothing.
  - Saving with no outside change does not read the file at all.
  - The file on disk never loses the other writer's changes unless Overwrite was clicked.
---

# First-contact eval: save-time conflict detection

A user whose file changed on disk saves in folio and gets a merge or
an explicit choice - never a silent clobber.
