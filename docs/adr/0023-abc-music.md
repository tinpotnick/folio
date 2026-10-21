# ADR-0023: ABC sheet music, played by folio's own synth

Date: 2026-10-21

Status: accepted

## Context

Strudel blocks (ADR-0014) make patterns; there was no way to show
notated music. ABC notation is the common plain-text format for
tunes, and abcjs engraves it in the browser. abcjs's own playback
downloads instrument soundfonts from the internet, which conflicts
with offline documents (ADR-0005).

## Decision

- ```` ```abc ```` blocks are drawn figures (docs/specs/drawn-blocks.md),
  engraved by **abcjs** 6 (MIT, maintained, lazy-loaded) in the
  theme's ink and fonts.
- **Playback is folio's own** (`src/audio/tone-synth.ts`): abcjs
  provides only the note sequence (`parseOnly` + `setUpAudio`), and
  Web Audio oscillators (triangle wave, short envelope) sound it.
  Nothing is downloaded, so it works offline. The sound is plain
  rather than piano-like, by choice.
- The AudioContext is created and resumed inside the Play click, as
  WebKit's autoplay rules require (ADR-0014's lesson).

## Consequences

- No soundfont realism. If wanted later, the online-samples consent
  of ADR-0019 is the route.
