# Audio embeds

## Status: accepted (2026-10-20)

## Decision

A recorded sound is MEDIA - the temporal sibling of an image, not
execution. Audio embeds as a directive block played by the NATIVE
`<audio controls>` element: no player dependency (ADR-0007 is
satisfied by the platform itself), no autoplay, no styling knobs -
the theme schema stays closed, and a document that talks stays a
document, not a jukebox.

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
- **The label strip**: the native widget swallows pointer events
  (its controls live in a UA shadow DOM), so every audio figure
  carries a small `.folio-audio-label` strip ABOVE the player
  showing the alt text ("audio clip" when empty). It is the
  figure's clickable identity - mousedown on it reveals the
  uniform inspector bar, like a code block's header - and it
  names the sound in print when the player itself is hidden.
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
- **Playback**: the native element with `controls` and
  `preload="metadata"` - a URL, a duration, and a play button the
  platform provides. Nothing else. Audio is not "run": the
  document has no execution affordances, and pressing play on an
  audio figure is no more execution than looking at an image.
- **Print**: a sound cannot print. The print stylesheet hides the
  element; the figure keeps its caption and alt so the document
  on paper still says what the sound is.
- **Source view**: the `::: audio` directive lines highlight as
  `directive` tokens (the generic directive grammar; no separate
  highlight state).

## Acceptance

- Engine: `tests/engine/doc.test.ts` (parse, byte-identity,
  missing src, unknown keys, coexistence with prose/headings).
- e2e: `tests/e2e/audio.spec.ts` (hand-typed directive renders
  the native element; insert-from-file embeds a real WAV and
  reaches the Markdown source; inspector alt/caption/replace;
  dismissal contract; Backspace removal; 8 MB refusal; recording
  via a fake microphone device, and the denied-mic error path).
- First-contact eval: `evals/audio-embeds-first-contact.md`.
