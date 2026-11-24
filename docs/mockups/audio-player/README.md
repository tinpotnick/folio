# Audio player mock-ups (design exploration, not wired up)

Static mock-ups of a folio-owned audio player for the `::: audio`
figure, rendered with the real default-theme palettes
(`src/render/theme.ts` `DEFAULT_THEME` + `CHROME`, light and dark)
and the bundled Source Serif 4 / Inter faces. These are throwaway
design artifacts for discussion — nothing here is referenced by the
app. Regenerate with `node gen-mockups.mjs` in this directory (needs
`npm i --no-save @resvg/resvg-js wawoff2 @fontsource/source-serif-4
@fontsource/inter` once; the script decodes the woff2 fonts into the
gitignored `fonts/`).

## Where we are today

An audio block (`docs/specs/audio-embeds.md`) renders the native
`<audio controls>` element: full width, nothing else. The native
widget is platform chrome — it looks different in Chromium and
WebKitGTK, ignores the document theme entirely, and cannot grow
controls (waveform seek, speed). That is the gap these mocks close.

**Adding an audio file without recording already works** — three
paths, no mic involved (see `insert-menu.png`):

- Insert menu → **Audio clip** (`#btn-audio` → the hidden
  `#audio-file` picker, `accept="audio/*"`), read as a data URI,
  `alt` seeded from the file name.
- Command palette → **Insert an audio clip**.
- On an existing audio figure, the inspector bar's **Replace file…**
  input swaps the `src`.

**Record audio** is a second input path for the same block (mic
button / palette → `getUserMedia` + `MediaRecorder`), not the only
way in.

## Design goals

1. **Theme-owned, closed schema** — every color comes from existing
   `--folio-*` variables (`accent`, `tint`, `hairline`, `ink-muted`,
   `paper`, `focus`); no new `audio.*` theme keys (ADR-0002).
2. **Offline, no dependency** — playback stays on the same hidden
   `<audio>` element; the player is our own DOM driving it. Waveform
   peaks come from `decodeAudioData` on the data URI (already in the
   document); external URLs degrade to a plain progress bar. ADR-0007
   stays satisfied by the platform.
3. **Document-first** — the player is media, not execution: play is
   no more "running" than viewing an image (AGENTS.md non-negotiable).
4. **Same figure contract** — label strip, inspector bar
   (alt / caption / replace file), reveal-on-click / hide-on-click-
   outside / Esc, Backspace-removes: unchanged
   (`docs/specs/figure-inspectors.md`).
5. **Print unchanged** — the print stylesheet hides the player card;
   the label strip and caption still say what the sound is.

## Variants

- `variant-a-waveform.png` / `variant-a-waveform-dark.png` —
  **A: waveform card** (SoundCloud-style). Accent play disc, waveform
  with the played portion in accent + playhead, `current / total`
  time. Seek by click/drag on the waveform. **Recommended default.**
  Cost: ~92 px tall and it wants decoded peaks.
- `variant-b-strip.png` — **B: compact strip**. The native player's
  shape, but in theme vars: slim progress track, time, volume, `1×`
  chip. Smallest footprint in prose; coarse seek, no waveform.
- `variant-c-controls.png` — **C: card + controls row**. A plus a
  second row: playback-speed popover (0.75×–2×), volume slider,
  download (exports the embedded file). Speed is genuinely useful
  for interviews/lectures; the row is the busiest of the three.
- `edit-trim.png` — **trim editing state** on card A: drag in/out
  handles over the waveform, `0:12 – 1:58 of 2:31 selected`,
  Cancel / Apply trim.
- `insert-menu.png` — the Insert menu with **Audio clip** (file) next
  to **Record audio** (mic): the two input paths side by side.

All colors in every scene are the default theme's `--folio-*`
values; the dark scenes are the dark mode of the same theme, so all
ten themes + dark mode restyle the player for free.

## Controls and editing — recommendation

- **v1 (with the player):** play/pause, waveform seek, time, volume,
  speed, download. All are playback state of the same `<audio>`
  element — the document model does not change at all.
- **Where they live:** ship variant A as the card; keep speed /
  volume / download in the card's second row (variant C) but
  collapse it unless the figure is hovered/focused, so the reading
  surface stays calm. Do not add a per-document "player style" key —
  that would grow the closed theme schema for little gain.
- **Editing (phase 2):** the block is just `src` (a data URI), so any
  edit means decode → process → re-encode inside the component
  (Web Audio; write a new data URI back to `src` through the same
  undoable block change). The engine and parser stay untouched and
  the 8 MB ceiling still applies. First candidate: **trim**
  (`edit-trim.png`) — the most common fix for a bad take. Fades /
  normalize can come later; "replace file" already covers wholesale
  swaps today.

## Implementation sketch (follow-up PR, not this one)

- `src/component.ts` `renderAudio`: keep the `<audio>` element
  (controls removed, still the playback engine) and build the player
  DOM around it. Peaks: `decodeAudioData` on data URIs, RMS bars;
  plain progress bar when peaks are unavailable. Label strip,
  inspector bar, selection/Backspace behavior untouched.
- `src/render/theme.ts`: rules scoped to `figure.folio-audio`,
  reading only existing `--folio-*` vars. Mind the Chrome traps
  (docs/reviewers/ui-design.md): no backticks in the template-literal
  comments, no `font:` shorthand, scope `figure svg` test locators.
- WebKitGTK: the custom player also removes the engine-dependent
  native-controls look; add a `tests/webkitgtk/` native case.
- Same-commit updates per AGENTS.md: `docs/specs/audio-embeds.md`
  (playback section), `tests/e2e/audio.spec.ts` (player replaces the
  `audio[controls]` assertions), `evals/audio-embeds-first-contact.md`,
  and palette/help entries for any new command (e.g. "Trim audio
  clip").

## Open questions

1. A as the single default, or A with C's row collapsed — any need
   for the bare B strip in dense prose?
2. Speed/volume/download on the card (C) vs. inside the inspector
   bar only?
3. Trim in the first player PR, or strictly phase 2?
4. Keyboard: Space to toggle play when the figure is selected
   (today Space on a selected figure does nothing)?
