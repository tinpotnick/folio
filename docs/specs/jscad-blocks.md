# JSCAD models

## Status: accepted (2026-10-21, ADR-0020)

## Decision

A ```` ```jscad ```` code block renders as its 3D MODEL: a themed,
flat-shaded SVG drawn from JSCAD code that runs in a sealed worker.
The model is the figure; the code is how you edit it.

## Contract

- **Model**: no new block kind: `{ kind: "code", lang: "jscad" }`,
  so the fence round-trips byte for byte.
- **Script forms** (`src/jscad/evaluate.ts`):
  `require('@jscad/modeling')`, `module.exports = { main,
  getParameterDefinitions }` (each parameter's `initial`/`default`/
  `checked` is passed to `main`), or a plain top-level `main`. `main`
  returns a shape or an array (nested arrays flatten). 3D solids draw
  as they are; 2D shapes draw as a flat, two-sided face. A shape's own
  colour (`colorize`) wins over the theme's.
- **Errors** are the figure's text, "Model error: ...", for: no
  `main`, no shapes returned, `require` of anything else, exceptions,
  a script running past 5 seconds (it is stopped), and more than
  60,000 faces ("lower its segments").
- **Sandbox** (ADR-0020): a module worker with the network, script
  loading and storage removed before any document code runs. Only
  faces come back.
- **Rendering** (`src/render/mesh-svg.ts`): orthographic; yaw about
  Z, then pitch; back faces and edge-on faces culled; light from the
  viewer's upper left; far faces first; fitted to a 640x400 viewBox.
  The default fill is the theme's first series colour, lifted toward
  the paper in light mode; dark mode repaints with the dark palette.
- **Header** (the one inspector contract): click the model to reveal
  the header (language picker and a **view** picker: Isometric,
  Front, Right, Top) AND the code; click away to hide both. Dragging
  the model turns it. View and angle are presentation only, never
  saved.
- **Editing** the code redraws the model 600 ms after typing pauses.
- **Insert**: the palette's **Insert a 3D model (JSCAD)** adds a
  starter part (a block with a bore); "JSCAD (3D model)" is in every
  code block's language picker.
- **Print**: the model prints; the code does not (the header is
  hidden).

## Acceptance

- Unit: `tests/render/mesh-svg.test.ts` (culling per view, shading,
  fit, own colours, two-sided faces, the face limit),
  `tests/render/jscad-evaluate.test.ts` (script forms, parameters,
  colours, 2D, error messages).
- e2e: `tests/e2e/jscad.spec.ts` (the sample draws every model; code
  hidden until a click, edits redraw; errors as the figure; an
  endless loop stopped at 5 s; no network in the sandbox; views and
  dragging; palette insert).
- WebKitGTK: `tests/webkitgtk/jscad.js` (a model draws in the desktop
  engine).
- Sample: `demo/examples/3d-models.md`. First-contact eval:
  `evals/jscad-first-contact.md`.
