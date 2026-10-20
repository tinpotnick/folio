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
  - Edit the pattern in place (not in the Markdown view) while it
    plays, and make the edit audible.
  - Switch to Markdown view, look at the block, and switch back.
  - Change the block's language to JavaScript, then back to Strudel.
expected:
  - The music button (a note icon, tooltip "Insert a Strudel music
    block") or the palette entry "Insert a Strudel music block"
    inserts the block; the help document describes it too.
  - The block renders as a code block; clicking into it reveals the
    code header - its language picker reads "Strudel (music)" and
    it carries a Play button and a Stop button. Play starts a synth
    pattern (audio, after the click); Stop ends it. While playing,
    the notes and pattern pieces that sound right now light up in
    the source and fade as they end; there is no moving playhead
    line.
  - Typing in the block while it plays turns Play into "Update";
    pressing it plays the edited pattern and the lights resume.
    The Markdown stays in sync with every edit.
  - The Markdown view shows a ```strudel fence containing exactly
    the pattern source; a view round-trip preserves it byte for
    byte.
  - Picking JavaScript removes the player and keeps the code
    (now highlighted as JavaScript, fence tag `javascript`);
    picking Strudel brings the player back.
---
