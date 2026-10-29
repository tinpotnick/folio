# Music with Strudel

- **Strudel** is the one language that plays: pick "Strudel
  (music)" in the language picker - or tag a fence `strudel` -
  and the code header gains **▶ Play** and **■ Stop**. Edit the
  pattern right in the block like any code. While it plays, the
  notes and pattern pieces sounding right now **light up** in
  the source and fade as they end. Edit while it plays and Play
  becomes **▶ Update** - press it to hear the change. A pattern
  like `note("c a f e")` loops as synthesized sound; see
  [strudel.cc](https://strudel.cc) for the language. The player
  itself is a free **add-on** (Strudel is AGPL-licensed, folio is
  MIT, so folio does not ship it): the first Play asks, then
  downloads it once and keeps it - after that, playback is offline
  and nothing more is downloaded. Melodic sounds are synthesized,
  and folio ships its own **drum kit** under the usual names:
  `bd` kick, `sd` snare, `hh` closed hat, `oh` open hat, `cp`
  clap, `rim`, `lt` `mt` `ht` toms, `cr` crash, `rd` ride, `cb`
  cowbell - e.g. `s("bd sd [hh hh] sd")`. Add `:1` (`bd:1`) for
  an alternative sound. Examples copied from strudel.cc that pick
  an online sample bank - `.bank("RolandTR808")`, pianos, other
  instruments - stay silent here, because those sounds are not in
  folio's offline kit; drop the `.bank(...)` to use folio's drums. An
  example that loads its own sounds from the internet
  (`samples('github:...')`, as many strudel.cc examples do) asks
  first: pressing Play shows a warning naming what it would
  download. **Download and play** fetches them (you need a
  connection, and you're asked once per session); **Play without
  them** plays everything else, fully offline. The *Amensister*
  example works this way.
- If something in a pattern fails while it plays (a sound that won't
  load, a scale name this version of Strudel rejects), the block's
  header says **Some sounds failed: ...** and the rest keeps playing.
  For example, current Strudel wants `.scale('G0:minor')`, not
  `'G0 minor'`.
