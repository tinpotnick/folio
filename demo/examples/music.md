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

Click the figure, then press ▶ Play in the inspector:

```strudel
note("c a f e").s(0.1)
```

That single line is a loop: the mini-notation inside the quotes
steps through the notes `c a f e`, one per cycle position, and
`.s(0.1)` fades each note quickly. Edit the source in the
inspector (Enter applies) or in the Markdown view.

## Make it groove

A slightly bigger pattern — a kick on every beat, a melody
weaving through it:

```strudel
s("<[~ sd*2]! ~>").bank("RolandTR808")
  .slow(2)
  .stack(note("<a4 [c5 e5] g4 f4>").lp(800))
```

Press ■ Stop when the neighbours complain.

## What you are hearing

- `note("...")` builds a pattern of synthesized notes; the text
  inside the quotes is Strudel's mini-notation, where spaces
  step in time and `<...>` alternates.
- `.stack(...)` layers patterns on top of each other.
- Playback is synthesized in the browser — no samples are
  downloaded, the document stays one offline file.

Everything else about this document — prose, the links, this
theme — is ordinary folio. Music is just one more block kind.
