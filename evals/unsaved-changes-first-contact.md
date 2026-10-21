---
name: unsaved-changes-first-contact
feature: unsaved changes (docs/specs/unsaved-changes.md)
steps:
  - In the desktop app, type into the welcome page, then click an
    example document link.
  - Choose Cancel; then try again and choose Save..., cancel the file
    dialog; then try again and choose Discard changes.
  - Edit the example, then close the window.
expected:
  - Before anything is lost, a dialog explains that the changes are
    not saved and offers Save..., Discard changes and Cancel.
  - Cancel and a cancelled save both leave the edit in place;
    Discard opens the example.
  - Closing the window with unsaved edits asks the same question.
---
