---
name: strudel-first-contact
feature: strudel-blocks
steps:
  - Start the demo host. Look at the toolbar's insert group without
    reading any documentation. Find a way to add music to the
    document using only visible affordances (toolbar icons,
    tooltips, the command palette, the in-app help).
  - Insert the music block. Without switching to Markdown view,
    make the pattern play, then stop it.
  - Edit the pattern in place (not in the Markdown view) and apply
    the edit.
  - Switch to Markdown view, look at the block, and switch back.
  - With the music figure selected, press Backspace.
expected:
  - The music button (a note icon, tooltip "Insert a Strudel music
    block") or the palette entry "Insert a Strudel music block"
    inserts the block; the help document describes it too.
  - The block renders as a figure with the pattern source; clicking
    the figure reveals an inspector bar with a Play button, a Stop
    button, and the source in a textarea. Play starts a synth
    pattern (audio, after the click); Stop ends it.
  - Editing the textarea and pressing Enter applies the edit: the
    figure's source updates and the Markdown stays in sync.
  - The Markdown view shows a ```strudel fence containing exactly
    the pattern source; a view round-trip preserves it byte for
    byte.
  - Backspace on the selected figure removes the whole block.
---
