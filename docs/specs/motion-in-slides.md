# Motion figures in slides

## Status: accepted (2026-11-10) - implemented on vibe/spec-next-features

## Decision

Motion figures (spec: motion-figures.md) play in slides too: a swarm
or flow figure on a slide autoplays and loops while that slide is
shown - the document's movement carries into the presentation.

## Rules

- In slides mode (`html.playing`), a motion figure's player autoplays
  exactly as in document view (15 fps loop, no transport controls);
  when the slide leaves, playback stops; returning to the slide
  restarts it. The print/PDF rendition of the slide is unchanged
  (filmstrip / trails / flowmap - a still cannot play).
- A `display: poster`/`frame:N` motion figure on a slide is static by
  choice, as in the document.
- Slides are one H1 each (spec: slides.md); a motion figure belongs to
  the slide of its enclosing section, as every figure does.

## Acceptance

- e2e: a deck containing a swarm figure plays it on its slide (frame
  counter advances while the slide is up, stops when advanced away).
- Print of that deck shows the static rendition.
