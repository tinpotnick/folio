# Audio embeds

## Status: accepted (2026-10-20)

## Decision

A recorded sound is MEDIA - the temporal sibling of an image, not
execution. Audio embeds as a directive block played by folio's OWN
player: a theme-styled card (mock-ups: docs/mockups/audio-player/)
over a hidden `<audio>` element - the platform element stays the
playback engine, so ADR-0007 is still satisfied by the platform
itself, no autoplay, and every color comes from the existing
`--folio-*` variables, so the theme schema stays closed. A document
that talks stays a document, not a jukebox.

```
::: audio {#founders-clip}
src: data:audio/mpeg;base64,...
alt: "the founder, on tape"
caption: "Founders interview, take two"
:::
```

Strudel blocks are the complement, not the overlap: strudel is
SYNTHESIZED audio (code the document carries); an audio block is
RECORDED media (a file the document carries).

## Contract

- **Keys**: `src` (required, raw/unquoted - data URIs and URLs
  carry no spaces), `alt` (quoted, optional - the sound's name,
  used for the element's title), `caption` (quoted, optional).
  Unknown keys are a parse error, like every directive. No
  hand-typed short form: Markdown has none for audio, and the
  directive is the only syntax.
- **Model**: `{ kind: "audio", audio: Audio }` in
  `src/engine/doc.ts`; `Audio` mirrors `Image` (`id`, `src`,
  `alt?`, `caption?`). Round-trip identity holds - the directive
  is already canonical.
- **Offline**: data URIs are the recommended form - the sound is
  the document (a sane 8 MB ceiling, the same as images, keeps the
  Markdown source workable; a 3-minute MP3 fits comfortably).
  External URLs/paths render opportunistically; they are never a
  render dependency.
- **Insert**: the insert group's speaker button opens the host
  file picker, reads the file as a data URI, and seeds `alt` from
  the file name.
- **The label strip**: every audio figure carries a small
  `.folio-audio-label` strip ABOVE the player showing the alt text
  ("audio clip" when empty). It is the figure's clickable identity
  and names the sound in print when the player itself is hidden.
  Editing the alt updates the strip live.

- **Recording** is a second input path for the same block - host
  chrome, never a model concept. The mic button (and the palette's
  "Record an audio clip") captures with `getUserMedia` +
  `MediaRecorder` - browser APIs, so ADR-0007 is satisfied by the
  platform. One button toggles: a press starts (the button pulses,
  the status bar counts elapsed time, capture auto-stops at three
  minutes - opus lands near 180 KB/min, so the ceiling holds); a
  second press stops, and the clip embeds as a data URI through
  the same `insertAudio()` the file picker uses, with `alt`
  seeded as "recording". A denied or missing microphone is a
  visible status message, never a silent failure; tracks are
  stopped and the button state cleared either way. Desktop: the
  Tauri shell registers `Builder::on_permission_request` and
  ALLOWs `PermissionKind::Microphone` - without a handler WebKitGTK
  silently denies every getUserMedia request. The record button is
  the consent gesture, so no second prompt; everything else falls
  through to the platform default. (macOS/iOS still need their
  own permission plumbing - untested there.)
- **Figure, not an editing surface**: `figure.folio-audio`
  (shadow-root scoped CSS: full-width element, the image figure's
  margins and focus outline) is `contentEditable="false"`, carries
  `data-block-index`, and survives structural syncs by figure
  identity like the other generated blocks. Click reveals the
  uniform inspector bar (alt, caption, replace file) on the
  click-outside-hides contract; Backspace/Delete on the selected
  figure removes the block.
- **Playback** (folio's own player, `buildAudioPlayer` in
  `src/component.ts`): the figure carries a hidden
  `audio.folio-audio-engine` element (`preload="metadata"`, no
  `controls`) plus a `.folio-audio-player` card - accent play/pause
  disc, waveform seek, `current / total` time, a playback-speed chip
  (0.75×–2×), and a hover row with volume and download. Waveform
  peaks come from `decodeAudioData` on the data URI; an external URL
  whose bytes cannot be decoded falls back to a plain progress track
  (`data-peaks="none"`). The card picks a density tier from its
  container width (`data-density`: card ≥ 480px, strip ≥ 240px,
  chip below - ResizeObserver), so the same component serves narrow
  containers later (e.g. table cells). The bar reveals on CLICK in
  the figure (not mousedown) so player controls receive their own
  clicks, and keyboard focus in the player (not from a mouse press)
  reveals it too; player controls own their keys - Backspace on a
  focused button never removes the figure. Audio is not "run": the
  document has no execution affordances, and pressing play on an
  audio figure is no more execution than looking at an image.
  The palette's "Play / pause the selected audio clip" toggles the
  last-clicked figure's player.
- **Print**: a sound cannot print. The print stylesheet hides the
  player card; the figure keeps its caption and alt so the document
  on paper still says what the sound is.
- **Source view**: the `::: audio` directive lines highlight as
  `directive` tokens (the generic directive grammar; no separate
  highlight state).

## Acceptance

- Engine: `tests/engine/doc.test.ts` (parse, byte-identity,
  missing src, unknown keys, coexistence with prose/headings).
- e2e: `tests/e2e/audio.spec.ts` (hand-typed directive renders the
  player over the hidden engine; play/pause, waveform seek, speed
  chip, density tiers, print hiding; insert-from-file embeds a real
  WAV and reaches the Markdown source; inspector alt/caption/
  replace; dismissal contract; Backspace removal; 8 MB refusal;
  recording via a fake microphone device, and the denied-mic error
  path). WebKitGTK: `tests/webkitgtk/audio-player-native.js`.
- First-contact eval: `evals/audio-embeds-first-contact.md`.
