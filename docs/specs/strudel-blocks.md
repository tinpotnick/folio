# Strudel code blocks

## Status: accepted (2026-11-14)

## Decision

Strudel (live-coding music, ADR-0014) is fully supported as a
language of the fenced code block: a fence tagged `strudel` renders
as a **figure with a player in its inspector**, not inert text.

## Contract

- **Model**: no new block kind. `{ kind: "code", lang: "strudel",
text }` - the existing fence block (docs/specs/
  code-blocks.md). Parser, serializer, and round-trip identity are
  untouched.
- **Render**: a code block (docs/specs/code-blocks.md) whose figure
  also carries `folio-strudel` and whose body is
  `pre.folio-code.strudel-source`. The body edits in place like any
  code block (there is no separate source textarea) and is
  syntax-highlighted as JavaScript.
- **Header**: the code header, its language picker reading
  "Strudel (music)", plus the player: a Play button (first press
  lazily loads @strudel/web and evaluates the body; the click is
  the autoplay gesture), a Stop button (hush), and the error line.
  Play while playing re-evaluates the body. Evaluation errors
  render as an inline `Strudel error: ...` line - error as
  content, never a broken render. The REPL logs evaluation errors
  instead of rejecting, so folio routes them via `onEvalError`.
  Picking another language stops playback and removes the player.
- **One REPL**: `initStrudel` runs once per component; a second
  call would create a second scheduler that keeps the first
  pattern playing past Stop. A full re-render (document load,
  structural edits) stops playback.
- **Playing lights** (the strudel REPL's own technique): the
  evaluator reports every mini-notation atom's source range up
  front (`repl.state.miniLocations`); the body is painted once with
  a `span.strudel-atom` per atom over the syntax colors. Every
  animation frame queries the playing pattern at the scheduler's
  current cycle (`scheduler.now()`) and lights (`.strudel-on`) the
  atoms of every hap sounding now - ALL of each hap's source
  locations (its note, its `struct`, its `mask`, its sound name),
  for the hap's whole duration. Lit atoms switch on instantly and
  fade out by CSS transition. There is no moving playhead line.
  The earlier per-trigger flash lit only each hap's LAST location,
  at trigger time (ahead of the audio by the scheduler's
  lookahead) - most of a tune like Caverave never lit. Editing the
  body while it plays stops the lights (the atom ranges no longer
  match the text; the audio plays on) and Play reads `▶ Update`.
  Stop removes the atom spans and restores plain syntax colors;
  the spans never reach the model (it reads `innerText`).
- **Offline (ADR-0005)**: the library is bundled and lazily
  imported, never fetched. folio loads no external sample banks
  itself: melodic sounds are synthesized, and drums come from folio's
  bundled CC0 kit (ADR-0016) under the standard names - `bd`
  (kick), `sd` (snare), `hh` (closed hat), `oh` (open hat), `cp`
  (clap/snap), `rim`, `lt`/`mt`/`ht` (toms), `cr` (crash), `rd`
  (ride), `cb` (cowbell), with variants via `bd:1` or `.n(1)`. The
  kit is registered and preloaded in the REPL's one-time setup
  (`prebake`), so the first beats are never skipped as late. Kit
  files are hashed assets emitted next to the bundle and loaded
  from the app's own origin.
- **Online samples, by consent (ADR-0019)**: a pattern's OWN
  `samples('github:...' | 'https://...' | 'shabda:...')` call, as in
  strudel.cc examples like "Amensister", downloads from the internet.
  Before evaluating such a pattern, Play shows a warning row
  (`.strudel-consent`) in the header. It names the sources and
  offers **Download and play** (allowed per source, for the session)
  or **Play without them** (`samples()` becomes a no-op: nothing is
  fetched, and the rest plays). An allowed download that fails is
  reported in the header ("Couldn't download the online sounds ...
  playing the rest") and never stops the pattern. The shipped
  example `demo/examples/amensister.md` exercises it.
- **Audio worklets load at setup**: `prebake` calls strudel's
  `initAudio()`, which loads the AudioWorklet effects (`shape`,
  `crush`, `coarse`, ...). `initStrudel` alone defers that to the
  NEXT mousedown on the page; folio initialises inside the Play
  click, so those effects failed on every note until the user
  happened to click again ("Amensister" played silent).
- **Playback errors reach the header**: errors raised DURING
  playback (a scale name the bundled strudel rejects, a sound that
  will not load, a worklet failure) are logged per note by strudel
  and never reject. While a block plays, folio listens to strudel's
  `strudel.log` event and shows the latest error in that block's
  header, e.g. "Some sounds failed: Scale name G0 is incomplete...".
  Playback continues. Before this, the console was the only place
  they appeared.
- **Markdown view**: ```strudel fences highlight with the standard
  fence/code tokens - no new token kinds.
- **Language picker**: "Strudel (music)" in any code block's
  header turns it into a strudel block (and back).
- **Toolbar**: a music-note button in the insert group
  (`#btn-strudel`). In document view it inserts a starter strudel
  block after the caret's block; in Markdown view it wraps the
  caret's paragraph in ```strudel fences (the code-button
  behavior).
- **Palette**: "Insert a Strudel music block" command reusing the
  toolbar button, keywords covering music/strudel/audio/beat.
- **Help**: the in-app help documents the feature in the SAME
  commit as the code (ADR-0009).

## The play-gesture contract (the play-does-nothing bug)

Web autoplay policy (strictest on WebKit - the desktop engine):
an AudioContext only runs when it is created AND resumed inside
a real user gesture. The library import is a heavy async
boundary, so a context created after `await import("@strudel/web")`
stays suspended forever - the clock never advances, and Play
does nothing. The fix is structural, not environmental:

- The play click SYNCHRONOUSLY creates (once) and resumes folio's
  own AudioContext, before the import runs, and hands it to
  `initStrudel({ audioContext })`.
- The Play button shows `Playing...` the moment it is clicked
  and reverts to `Play` on Stop or on any play error - the
  button can never look dead while the first load pays the
  import cost.
- **Audio watchdog**: after evaluate, folio polls its
  AudioContext for up to 2s. If it never reaches "running" (an
  engine that cannot open an audio device leaves it suspended or
  "interrupted"), playback stops, the button reads Play, and the
  error line says "Audio device unavailable - no sound output",
  with a hint to check the system audio output. A silent
  "Playing..." is never left up. (The original Linux-desktop
  silence turned out to be the zero-channel bug below, not a
  dead device; the watchdog stays as a guard.)

## The zero-channel destination (WebKitGTK, the Linux desktop)

WebKitGTK reports `destination.maxChannelCount` as 0 and rejects
every `destination.channelCount` assignment against that limit
("Channel count cannot be 0" / "exceeds maximum limit"). Strudel
sizes its output stage with `channelCount = maxChannelCount`, so
on Linux desktop every note failed (`[getTrigger] error`) while
the clock ran - Play looked alive but was silent. When folio's
context reports fewer than 1 channel, folio patches
`AudioDestinationNode.prototype` once: `maxChannelCount` reports
the channel count the destination actually has (at least 2), and
a refused `channelCount` assignment keeps the existing count. Both
overrides act only where the engine itself reports 0; other errors
still throw. It must be the PROTOTYPE: WebKit may collect the
destination's JS wrapper and hand out a fresh one, which drops
instance properties - the first, per-instance version of this fix
held for a short pattern and lost itself mid-way through
Caverave. Pinned by an e2e that stubs the WebKitGTK behaviour in
Chromium; verified in WebKitGTK 2.54 with Caverave.

Note for verification: a WebKitGTK probe must deliver clicks as
GTK input events (`gtk_widget_event` with a button press and
release), not DOM `dispatchEvent`. Only GTK input events carry user
activation, so a DOM-dispatched click leaves the context suspended.

## Acceptance

- e2e (`tests/e2e/strudel.spec.ts`, "online samples need consent"):
  Play asks first and fetches nothing until allowed; Download and
  play fetches, asks once per session, and reports a failed download
  while the rest plays; Play without them plays with zero requests;
  the Amensister example plays offline on request with its adapted
  scale. Unit: `tests/render/online-samples.test.ts`.
- e2e (`tests/e2e/strudel.spec.ts`): worklet effects (`shape`) play
  on the FIRST press with no AudioWorkletNode errors; an error during
  playback shows in the header.

- `just lint`, `just test`, `just build` green; engine fence tests
  unchanged and passing (a strudel fence round-trips byte-identical).
- e2e (`tests/e2e/strudel.spec.ts`): a strudel fence renders a
  code figure; source survives a view round-trip; the code header
  reveals on click (picker reads strudel, Play/Stop present, no
  textarea) and hides on an outside click; editing the body in
  place reaches the model; Enter in the body adds a line; Backspace
  in an emptied body removes the block; playback fetches nothing
  over the network; playback survives a zero-channel engine; the
  sounding atoms light (and move on), with no sweep line, and Stop
  restores the plain text; a sounding note lights ALL its
  locations; an evaluation error shows in the header; editing while
  playing pauses the lights and offers Update, which resumes them;
  an audio context that never runs shows "no sound output" and
  resets the player.
- e2e: every kit drum name plays from bundled assets with no
  "not found" or late-load errors and no remote request.
- e2e (`tests/e2e/palette.spec.ts`): the music example's Caverave
  lights up while playing, offline.
- First-contact eval: `evals/strudel-first-contact.md`.

## The player is an add-on (2026-10-22, ADR-0026)

- folio's builds do not contain Strudel (AGPL-3.0). Blocks render,
  edit and round-trip without it; only Play needs it.
- The first Play (after any online-samples consent) shows the add-on
  strip (`.strudel-addon`): what it is, its licence and size, and
  **Install and play** / **Not now**. Not now downloads nothing.
- Install and play unlocks audio inside the click, downloads release
  1.3.0's `index.mjs` and clock worker from jsDelivr, checks each
  against its pinned SHA-256, keeps them in IndexedDB
  (`folio-addons`), and plays. A failed or mismatched download is the
  block's error line ("did not match the expected release"), never
  run.
- Later plays load the kept copy (a blob module, its clock worker
  re-pointed at the kept file) with nothing downloaded.
- Acceptance: `tests/e2e/strudel-addon.spec.ts` (asks; Not now;
  installs once and keeps it; refuses a tampered download),
  `tests/render/strudel-addon.test.ts` (the pin matches the tested
  release; the loader's patch point exists),
  `tests/webkitgtk/strudel-addon.js` (the kept copy loads in the
  desktop engine).
