---
name: audio-embeds-first-contact
feature: audio embeds (docs/specs/audio-embeds.md)
steps:
  - Start the demo host. Click the mic button in the insert group,
    speak for a few seconds, then click it again.
  - Click the speaker icon in the insert group (after the image
    button).
  - Pick any audio file under 8 MB from the picker.
  - Click the new audio figure; in its bar set the alt text to
    what the sound is and add a caption; then use the bar's file
    control to replace the clip with a different file.
  - Click the figure once and press Backspace.
  - Switch to Markdown view, hand-type an `::: audio` directive
    with `src: https://example.com/a.mp3` and an alt line, and
    switch back to Document view.
  - Print preview the document (Ctrl+P).
expected:
  - The mic button pulses and the status bar counts while
    recording; the browser asks for microphone permission the
    first time. The second click stops the capture and embeds
    the clip at the caret, its label strip reading "recording"
    (editable like any alt).
  - The clip embeds in the page and plays through the browser's own
    audio controls; the file name seeds the alt text.
  - The inspector bar appears on click and hides on clicking
    outside; alt and caption edits show immediately and in the
    Markdown source as `alt:` / `caption:` lines; replacing the
    file swaps the src.
  - Backspace on the selected figure removes the block from both
    the document and the Markdown source.
  - The hand-typed directive renders the audio element with the
    external src and round-trips byte-identically.
  - In print, the player is hidden but the caption remains.
---
