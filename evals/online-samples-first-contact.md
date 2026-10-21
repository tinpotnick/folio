---
name: online-samples-first-contact
feature: online samples by consent (ADR-0019, docs/specs/strudel-blocks.md)
steps:
  - Start the desktop app and open the Amensister example from the
    welcome page.
  - Press Play.
  - Choose "Play without them", listen, then Stop.
  - Press Play again and choose "Download and play" (online).
  - Disconnect from the network, reload, and choose "Download and
    play" again.
expected:
  - Before any sound, the block warns that the pattern downloads
    sounds from the internet and names github:tidalcycles/dirt-samples.
  - "Play without them" plays the bass and chords with no network
    access.
  - "Download and play" adds the amen break; a second Play in the
    same session does not ask again.
  - Offline, the header says the download failed, and the rest still
    plays.
---
