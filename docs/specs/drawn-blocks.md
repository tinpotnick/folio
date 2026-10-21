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

## Vega-Lite (`vega-lite`, ADR-0022)

- The block is a Vega-Lite JSON spec; invalid JSON is "Chart error:
  the spec is not valid JSON (...)".
- `"data": {"name": "@dataset"}`, at any depth, reads the dataset's
  recalculated rows (`bindVegaData`, `src/render/vega-data.ts`).
  Editing the dataset redraws every Vega-Lite chart that names it
  (`refreshDependents`). An unknown dataset, or any `"data": {"url"}`,
  is an error naming the problem; the loader fetches nothing.
- Theme config (overridden by the spec's own `config`): the body face;
  ink for titles, axes, legends and headers; hairline grid; the theme
  palette as the category range; heatmaps and ramps run from the
  theme's tint to its accent; rules and text in ink; horizontal x
  labels. A single or layered chart with no `width` of its own takes
  the page's width.
- Rendered headless (`vega` `none` renderer) to SVG, then sanitized.

## SVG (`svg`)

- The block's markup, sanitized, is the drawing ("Drawing error: not
  valid SVG ..." when there is no `<svg>`).
- It inherits the page's ink as `currentColor`, and may use the
  theme's variables (`var(--folio-accent)`, `--folio-ink-muted`, ...),
  so a hand-drawn figure follows the theme and the mode.
- Natural size, shrunk only when wider than the page.

## Acceptance

- Unit: `tests/render/svg-sanitize.test.ts`,
  `tests/render/vega-data.test.ts`.
- e2e: `tests/e2e/drawn.spec.ts` (the sample draws, in the theme's
  face, code hidden; editing redraws; a syntax error is the figure;
  DOT links cannot run script; the palette inserts one; Vega-Lite reads
  a dataset and follows its edits, refuses URL data with no request,
  reports invalid JSON; SVG follows the theme's ink, scripts, handlers
  and outside loads are removed, non-SVG is reported). The JSCAD
  suite still passes on the shared path.
- Sample: `demo/examples/drawings.md`. First-contact eval:
  `evals/drawn-blocks-first-contact.md`.
