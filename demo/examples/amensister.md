---
theme: swiss
---

# Amensister

A pattern from the [Strudel](https://strudel.cc) example collection,
by Felix Roos: a chopped amen break, a wandering bass, stabbed chords
and two "alien" layers, stacked and re-triggered.

Unlike folio's other music, this one uses **online samples**. Its
first line, `samples('github:tidalcycles/dirt-samples')`, loads the
Dirt-Samples bank (the amen break, the breath, and the "east" voices)
from GitHub. When you press Play, folio asks first: **Download and
play** fetches them (you need a connection), and **Play without them**
plays the synth parts fully offline.

```strudel
// "Amensister"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos
// Adapted for folio: .scale('G0 minor') -> .scale('G0:minor')
// (Strudel 1.3 wants the colon form).

samples('github:tidalcycles/dirt-samples')

useRNG('legacy')

stack(
  // amen
  n("0 1 2 3 4 5 6 7")
  .sometimes(x=>x.ply(2))
  .rarely(x=>x.speed("2 | -2"))
  .sometimesBy(.4, x=>x.delay(".5"))
  .s("amencutup")
  .slow(2)
  .room(.5)
  ,
  // bass
  sine.add(saw.slow(4)).range(0,7).segment(8)
  .superimpose(x=>x.add(.1))
  .scale('G0:minor').note()
  .s("sawtooth")
  .gain(.4).decay(.1).sustain(0)
  .lpa(.1).lpenv(-4).lpq(10)
  .cutoff(perlin.range(300,3000).slow(8))
  .degradeBy("0 0.1 .5 .1")
  .rarely(add(note("12")))
  ,
  // chord
  note("Bb3,D4".superimpose(x=>x.add(.2)))
  .s('sawtooth').lpf(1000).struct("<~@3 [~ x]>")
  .decay(.05).sustain(.0).delay(.8).delaytime(.125).room(.8)
  ,
  // alien
  s("breath").room(1).shape(.6).chop(16).rev().mask("<x ~@7>")
  ,
  n("0 1").s("east").delay(.5).degradeBy(.8).speed(rand.range(.5,1.5))
).reset("<x@7 x(5,8,-1)>")
```

## Licence

"Amensister" is by Felix Roos and is licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/):
you may share and adapt it for non-commercial purposes, with credit,
under the same licence. The one change made here is marked in the
code's header comment. This licence covers this pattern only, not
folio itself.
