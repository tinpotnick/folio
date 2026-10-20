# ADR-0016: A bundled CC0 drum kit for strudel

Date: 2026-10-20

Status: accepted

## Context

ADR-0014 shipped strudel with synthesized sounds only and loads no
sample banks, keeping documents offline (ADR-0005). But drums in
strudel and Tidal are sample sounds (`bd`, `sd`, `hh`, ...): every
drum hit failed with `sound bd not found`. So the drums of real
tunes such as the music example's Caverave were silent everywhere,
browser and desktop alike, while the playing highlight still lit
them.

The samples strudel.cc loads by default (tidalcycles/Dirt-Samples,
ritchse/tidal-drum-machines) state no licence, and the classic
TR-808 recordings they include say only "ABSOLUTELY FREE", which is
not a licence grant. They cannot be redistributed safely, and
fetching them at play time would break the offline guarantee.

## Decision

Bundle a small drum kit with the component:

- **Source and licence:** 20 one-shots from Sonic Pi's sample set,
  originally from freesound.org and dedicated to the public domain
  under **CC0 1.0**, per Sonic Pi's samples README. Per-file
  provenance is recorded in `src/audio/drums/README.md`.
- **Names:** the standard strudel/Tidal drum names (`bd sd hh oh cp
  rim lt mt ht cr rd cb`, with `name:n` variants), so published
  tunes play unchanged. The default variants lean electronic (a
  short, tight kick and snare) to suit strudel's synth sounds.
- **Size:** about 670 KB of FLAC (lossless; decoded by Chromium,
  WebKit and Firefox).
- **Offline (ADR-0005):** the files are emitted as hashed assets
  next to the component bundle (`new URL(..., import.meta.url)`) and
  load from the app's own origin. Nothing is fetched from the
  network, and documents carry no audio.
- **Loading:** registered and preloaded in strudel's one-time setup
  (`prebake`), only when something plays. Strudel loads samples
  lazily and skips a hit whose buffer arrives late, so a cold kit
  would drop the first beats.

## Consequences

- ADR-0014's "no sample banks" consequence is amended: no
  *external* banks; folio's own CC0 kit is bundled.
- First Play pays for fetching and decoding the kit, about 20 ms
  locally. Documents that never play pay nothing.
- Further sounds must meet the same bar: a clear CC0 or equally
  free licence, with provenance recorded in the kit README.
- Custom per-document samples (for example as data URIs, like
  images in ADR-0013) remain a separate future decision.
