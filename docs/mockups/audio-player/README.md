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
  time, and a **speed chip** (`1.5×`) at the right edge.
  **Recommended default.** Cost: ~92 px tall and it wants decoded
  peaks.
- `variant-a-speed-open.png` — A with the speed popover open
  (0.75×–2×, current checked). Speed lives in the card's top row, not
  a separate controls row — it is the one extra control worth always
  seeing (interviews, lectures, language learning).
- `variant-b-strip.png` — **B: compact strip**. The native player's
  shape, but in theme vars: slim progress track, time, volume, `1×`
  chip. This is also the **medium density tier** (see sizes).
- `variant-c-controls.png` — **C: card + hover controls row**
  (speed, volume slider, download). Kept as the "everything on
  hover" option rather than the default.
- `edit-trim.png` — **trim editing state** on card A: drag in/out
  handles over the waveform, `0:12 – 1:58 of 2:31 selected`,
  Cancel / Apply trim.
- `insert-menu.png` — the Insert menu with **Audio clip** (file) next
  to **Record audio** (mic): the two input paths side by side.

## Sizes: one player, three densities

`sizes-ladder.png` shows the same clip at three container widths —
the player picks its tier from the width of its container:

- **card** (≥ ~480 px, the document measure): variant A.
- **strip** (~240–480 px): variant B, compact (no volume slider).
- **chip** (< ~240 px): play/pause + duration pill — the form audio
  takes inside a **table cell** (`table-audio.png`).

Mechanism: a container query (`container-type: inline-size` on the
figure + `@container` rules) is the clean CSS way and works in both
engines we target (Chromium, WebKitGTK ≥ 2.38); a ResizeObserver
toggling `data-density` is the engine-proof fallback if WebKitGTK
parity ever lags. Either way the same component renders all three
tiers — no separate widgets.

## Audio in a table — today: no; proposed: an `@aud:` chip

Checked against the engine: table cells are plain text today
(`td.textContent`, `src/component.ts` ~line 5374 — cells do not go
through the inline parser), no block directive can nest inside a
cell, and audio is not a cross-reference target either
(`crossRefTargets` in `src/component.ts` has table/chart/motion/
image/diagram, no audio; `XREF_PREFIX` is `tbl|fig|sec|eq` in
`src/engine/citations.ts`).

So `::: audio` inside a table is not possible without breaking the
cell grammar — but it does not need to be. Proposal
(`table-audio.png`): a new inline reference **`@aud:clip-id`**
(extending `XREF_PREFIX`, one branch in the cell renderer) that
renders as the **chip tier** and plays the one `::: audio {#clip-id}`
block that owns the data URI. The cell stores only the id — the 8 MB
ceiling stays on the single block, and editing the clip once updates
every cell that references it. This is the same `@audio-id` idea the
flashcards draft (PR #182) uses for card sounds, so the two features
would share one reference mechanism. The chip is also the natural
form for audio references in prose.

## Controls and editing — recommendation

- **v1 (with the player):** play/pause, waveform seek, time, **speed
  chip in the card** (variant A as mocked), volume + download on
  hover only (variant C's row, collapsed by default). All are
  playback state of the same `<audio>` element — the document model
  does not change at all.
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
  DOM around it; density tier from container width. Peaks:
  `decodeAudioData` on data URIs, RMS bars; plain progress bar when
  peaks are unavailable. Label strip, inspector bar,
  selection/Backspace behavior untouched.
- Table chips: `@aud:id` prefix in `src/engine/citations.ts`
  (`XREF_PREFIX`), an audio branch in `crossRefTargets`, and a
  cell-render special case that swaps the token for the chip player.
- `src/render/theme.ts`: rules scoped to `figure.folio-audio` (and
  `.folio-audio-chip`), reading only existing `--folio-*` vars.
  Mind the Chrome traps (docs/reviewers/ui-design.md): no backticks in
  the template-literal comments, no `font:` shorthand, scope
  `figure svg` test locators.
- WebKitGTK: the custom player also removes the engine-dependent
  native-controls look; add a `tests/webkitgtk/` native case.
- Same-commit updates per AGENTS.md: `docs/specs/audio-embeds.md`
  (playback section) + a table-cell audio note,
  `tests/e2e/audio.spec.ts` (player replaces the `audio[controls]`
  assertions), `evals/audio-embeds-first-contact.md`, and
  palette/help entries for any new command (e.g. "Trim audio clip").

## Open questions

1. Speed chip always visible in the card (recommended) vs. hover-only
   with volume/download (variant C)?
2. Chip in table cells via `@aud:id` — also allow the chip inline in
   prose, or table cells only?
3. Trim in the first player PR, or strictly phase 2?
4. Keyboard: Space to toggle play when the figure is selected
   (today Space on a selected figure does nothing)?
5. Density breakpoints (480 / 240 px) — fine, or should the strip
   start lower so prose figures stay cards longer?
