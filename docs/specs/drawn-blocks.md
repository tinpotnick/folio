# Drawn code blocks

## Status: accepted (2026-10-21)

## Decision

Some code languages describe a PICTURE. Their block is DRAWN: the
figure is the picture, and the code is how you edit it. This is one
contract for every such language (JSCAD, Graphviz, and the ones that
follow), so each new language adds only its own drawing function.

## Contract

- **Model**: an ordinary fenced code block; on GitHub it stays code.
- **Registry**: `DRAWN_LANGS` in the component (language -> the
  picture's accessible name). Drawn figures carry `folio-drawn
  folio-<lang>`; the picture lives in `.code-view`.
- **The code shows only while the header is open** (the one inspector
  contract): click the picture to reveal the header and code, click
  away to hide both.
- **Redraw**: typing in the code redraws 600 ms after the pause;
  switching light/dark redraws in the mode's colours.
- **Errors are the figure**: "<What> error: message" in
  `.code-view.drawn-error` (JSCAD keeps "Model error" /
  `.jscad-error`).
- **SVG is sanitized** (`src/render/svg-sanitize.ts`): shapes, text,
  styles, `#id` references and `data:` images stay; scripts, event
  handlers, `javascript:` links, `foreignObject`/iframes, and anything
  that would LOAD from outside (external `href`s, `url(http...)`,
  `@import`) are removed. Plain web links on `<a>` stay, since a click
  loads nothing on render.
- **Insert**: each language has a palette entry and a language-picker
  entry; inserting on an empty line takes the line's place.

## Graphviz (`dot`, also `graphviz`)

- Laid out and drawn by Graphviz (`@viz-js/viz`, WebAssembly,
  bundled, loaded on the first diagram; ADR-0021). It is draw-only:
  no script runs.
- The theme supplies DEFAULT attributes, which the graph's own
  attributes override: the text face (the theme's body font), ink,
  rules, node fill (the theme's tint) and border (accent), edge colour
  (muted), and a node margin. Graphviz measures text with its own
  metrics, so the margin keeps labels off the border.
- Natural size, shrunk only when wider than the page.
- DOT `URL`/`href` attributes become sanitized links.

## Acceptance

- Unit: `tests/render/svg-sanitize.test.ts`.
- e2e: `tests/e2e/drawn.spec.ts` (the sample draws, in the theme's
  face, code hidden; editing redraws; a syntax error is the figure;
  DOT links cannot run script; the palette inserts one). The JSCAD
  suite still passes on the shared path.
- Sample: `demo/examples/drawings.md`. First-contact eval:
  `evals/drawn-blocks-first-contact.md`.
