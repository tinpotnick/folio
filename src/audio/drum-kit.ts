/**
 * folio's bundled drum kit for strudel (ADR-0016, spec: docs/specs/
 * strudel-blocks.md). CC0 one-shots from Sonic Pi's sample set
 * (freesound.org, public domain - provenance in drums/README.md),
 * mapped to the standard strudel/Tidal drum names so published
 * tunes play unchanged: `s("bd sd hh")`, `s("bd:1")` picks the
 * second variant.
 *
 * The files ship WITH the component (Vite emits each as a hashed
 * asset next to the bundle) and load from the app's own origin -
 * never from the network - so documents still play offline.
 */
const KICK_HOLLOW = new URL("./drums/elec_hollow_kick.flac", import.meta.url);
const KICK_BOOM = new URL("./drums/drum_bass_hard.flac", import.meta.url);
const KICK_SOFT = new URL("./drums/elec_soft_kick.flac", import.meta.url);
const SNARE_HI = new URL("./drums/elec_hi_snare.flac", import.meta.url);
const SNARE_ELEC = new URL("./drums/elec_snare.flac", import.meta.url);
const SNARE_HARD = new URL("./drums/drum_snare_hard.flac", import.meta.url);
const SNARE_MID = new URL("./drums/elec_mid_snare.flac", import.meta.url);
const HAT_CLOSED = new URL("./drums/drum_cymbal_closed.flac", import.meta.url);
const HAT_PEDAL = new URL("./drums/drum_cymbal_pedal.flac", import.meta.url);
const HAT_OPEN = new URL("./drums/drum_cymbal_open.flac", import.meta.url);
const SNAP = new URL("./drums/perc_snap.flac", import.meta.url);
const SNAP_2 = new URL("./drums/perc_snap2.flac", import.meta.url);
const TICK = new URL("./drums/elec_tick.flac", import.meta.url);
const WOOD = new URL("./drums/elec_wood.flac", import.meta.url);
const TOM_LO = new URL("./drums/drum_tom_lo_hard.flac", import.meta.url);
const TOM_MID = new URL("./drums/drum_tom_mid_hard.flac", import.meta.url);
const TOM_HI = new URL("./drums/drum_tom_hi_hard.flac", import.meta.url);
const CRASH = new URL("./drums/drum_cymbal_hard.flac", import.meta.url);
const RIDE = new URL("./drums/drum_cymbal_soft.flac", import.meta.url);
const COWBELL = new URL("./drums/drum_cowbell.flac", import.meta.url);

/** Strudel sound name -> sample URLs (index = `n` / `name:n`). */
export const DRUM_KIT: Record<string, string[]> = {
  bd: [KICK_HOLLOW, KICK_BOOM, KICK_SOFT].map(String),
  sd: [SNARE_HI, SNARE_ELEC, SNARE_HARD, SNARE_MID].map(String),
  hh: [HAT_CLOSED, HAT_PEDAL].map(String),
  oh: [HAT_OPEN].map(String),
  cp: [SNAP, SNAP_2].map(String),
  rim: [TICK, WOOD].map(String),
  lt: [TOM_LO].map(String),
  mt: [TOM_MID].map(String),
  ht: [TOM_HI].map(String),
  cr: [CRASH].map(String),
  rd: [RIDE].map(String),
  cb: [COWBELL].map(String),
};

/** Every sample URL in the kit, for preloading. */
export function drumKitUrls(): string[] {
  return [...new Set(Object.values(DRUM_KIT).flat())];
}
