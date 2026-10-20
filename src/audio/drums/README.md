# folio drum kit - samples and provenance

These one-shot drum samples ship with folio's strudel player
(ADR-0016). They are taken unmodified from Sonic Pi's sample set
(https://github.com/sonic-pi-net/sonic-pi, `etc/samples/`), whose
README states:

> All other samples in this directory are from http://freesound.org
> and have also been placed in the public domain via the Creative
> Commons 0 License: http://creativecommons.org/publicdomain/zero/1.0/

Licence: **CC0 1.0** (public domain dedication). No attribution is
required; the sources are listed so provenance stays auditable.

| File                    | strudel name    | Original source                                            |
| ----------------------- | --------------- | ---------------------------------------------------------- |
| elec_hollow_kick.flac   | `bd` (`bd:0`)   | https://freesound.org/people/looppool/sounds/13099/        |
| drum_bass_hard.flac     | `bd:1`          | https://freesound.org/people/menegass/sounds/100051/       |
| elec_soft_kick.flac     | `bd:2`          | https://freesound.org/people/looppool/sounds/13142/        |
| elec_hi_snare.flac      | `sd` (`sd:0`)   | https://freesound.org/people/looppool/sounds/13125/        |
| elec_snare.flac         | `sd:1`          | https://freesound.org/people/looppool/sounds/13146/        |
| drum_snare_hard.flac    | `sd:2`          | https://freesound.org/people/menegass/sounds/100058/       |
| elec_mid_snare.flac     | `sd:3`          | https://freesound.org/people/looppool/sounds/13132/        |
| drum_cymbal_closed.flac | `hh` (`hh:0`)   | https://freesound.org/people/menegass/sounds/100053/       |
| drum_cymbal_pedal.flac  | `hh:1`          | https://freesound.org/people/menegass/sounds/100054/       |
| drum_cymbal_open.flac   | `oh`            | https://freesound.org/people/menegass/sounds/100055/       |
| perc_snap.flac          | `cp` (`cp:0`)   | https://freesound.org/people/SoundCollectah/sounds/109400/ |
| perc_snap2.flac         | `cp:1`          | https://freesound.org/people/Peram/sounds/158615/          |
| elec_tick.flac          | `rim` (`rim:0`) | https://freesound.org/people/looppool/sounds/13113/        |
| elec_wood.flac          | `rim:1`         | https://freesound.org/people/looppool/sounds/13135/        |
| drum_tom_lo_hard.flac   | `lt`            | https://freesound.org/people/menegass/sounds/100064/       |
| drum_tom_mid_hard.flac  | `mt`            | https://freesound.org/people/menegass/sounds/100066/       |
| drum_tom_hi_hard.flac   | `ht`            | https://freesound.org/people/menegass/sounds/100062/       |
| drum_cymbal_hard.flac   | `cr`            | https://freesound.org/people/menegass/sounds/100056/       |
| drum_cymbal_soft.flac   | `rd`            | https://freesound.org/people/menegass/sounds/100057/       |
| drum_cowbell.flac       | `cb`            | https://freesound.org/people/Neotone/sounds/75338/         |

The name mapping lives in `src/audio/drum-kit.ts`. Adding a sound:
drop in a CC0 (or equally free) file, record its source here, and
add it to the map.
