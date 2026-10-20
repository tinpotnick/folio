---
theme: corporate-report
style:
  body.font.family: "Source Serif 4"
---

# A little bit of fun

Documents carry rhythm, not just numbers. This folio document
embeds [Strudel](https://strudel.cc) — a live-coding music
language — in coding blocks that play right in the page.

## Four notes

Click into the block, then press ▶ Play in its header:

```strudel
note("c a f e").decay(0.15).sustain(0)
```

That single line is a loop: the mini-notation inside the quotes
steps through the notes `c a f e`, one per cycle position, and
`.decay(0.15).sustain(0)` makes each note die away quickly instead
of holding. Edit the pattern right in the
block - while it plays, ▶ Update applies the edit - or in the
Markdown view.

## Make it groove

A slightly bigger pattern — a kick on every beat, a melody
weaving through it:

```strudel
stack(
  s("bd*4"),
  s("~ sd ~ sd"),
  s("hh*8").gain(0.4),
  note("<a4 [c5 e5] g4 f4>").lpf(800)
)
```

Line by line:

- `s("bd*4")` — `s` picks a sound; `bd` is the kick drum, and `*4`
  plays it four times per cycle: a kick on every beat.
- `s("~ sd ~ sd")` — four steps, where `~` is a rest: the snare
  (`sd`) lands on beats two and four.
- `s("hh*8").gain(0.4)` — closed hi-hat eight times per cycle,
  turned down so it sits behind the rest.
- `note("<a4 [c5 e5] g4 f4>")` — the melody. `<...>` plays ONE
  entry per cycle, taking turns, and `[c5 e5]` squeezes two notes
  into one step. `.lpf(800)` (a low-pass filter) softens the tone.
- `stack(...)` plays all four layers at the same time.

The drums come from folio's built-in kit — the in-app help lists
every drum name (`bd`, `sd`, `hh`, `oh`, `cp`, toms, cymbals).

Press ■ Stop when the neighbours complain.

## Caverave

The Strudel project ships its own open-source tune collection -
this one is "Caverave" by Felix Roos, licensed CC BY-NC-SA 4.0
(https://strudel.cc), reproduced from the strudel repository.
Drums from folio's built-in kit, plus a layered synth arpeggio,
chords, and a bassline synthesized in the browser - press ▶ Play
and watch the notes light up:

```strudel
// "Caverave"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

const keys = x => x.s('sawtooth').cutoff(1200).gain(.5)
  .attack(0).decay(.16).sustain(.3).release(.1);

const drums = stack(
  s("bd*2").mask("<x@7 ~>/8").gain(.8),
  s("~ <sd!7 [sd@3 ~]>").mask("<x@7 ~>/4").gain(.5),
  s("[~ hh]*2").delay(.3).delayfeedback(.5).delaytime(.125).gain(.4)
);

const synths = stack(
  
  "<eb4 d4 c4 b3>/2"
  .scale("<C:minor!3 C:melodic:minor>/2")
  .struct("[~ x]*2")
  .layer(
    x=>x.scaleTranspose(0).early(0),
    x=>x.scaleTranspose(2).early(1/8),
    x=>x.scaleTranspose(7).early(1/4),
    x=>x.scaleTranspose(8).early(3/8)
  ).note().apply(keys).mask("<~ x>/16")
  .color('darkseagreen'),
  
  note("<C2 Bb1 Ab1 [G1 [G2 G1]]>/2")
  .struct("[x [~ x] <[~ [~ x]]!3 [x x]>@2]/2".fast(2))
  .s('sawtooth').attack(0.001).decay(0.2).sustain(1).cutoff(500)
  .color('brown'),
  chord("<Cm7 Bb7 Fm7 G7b13>/2")
  .struct("~ [x@0.2 ~]".fast(2))
  .dict('lefthand').voicing()
  .every(2, early(1/8))
  .apply(keys).sustain(0)
  .delay(.4).delaytime(.12)
  .mask("<x@7 ~>/8".early(1/4))
).add(note("<-1 0>/8"))
stack(
  drums.fast(2).color('tomato'), 
  synths
).slow(2)
```

Press ■ Stop when the neighbours complain. (That heading is
borrowed from earlier - the advice applies doubly here.)

## What you are hearing

- `note("...")` builds a pattern of synthesized notes; the text
  inside the quotes is Strudel's mini-notation, where spaces
  step in time and `<...>` alternates.
- `.stack(...)` layers patterns on top of each other.
- `s("bd sd hh")` plays drums from folio's built-in kit (kick,
  snare, hi-hat, and more - see the help). Nothing is downloaded,
  so the document stays one offline file.

Everything else about this document — prose, the links, this
theme — is ordinary folio. Music is just one more block kind.
