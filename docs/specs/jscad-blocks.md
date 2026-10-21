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
  viewer's upper left; fitted to a 640x400 viewBox. Painting order is
  EXACT up to 2,500 faces: a BSP tree, built once per model, walked
  back to front for each view. Centroid sorting misordered gear teeth
  and hole walls. Above 2,500 faces (where a BSP costs O(n^2) to
  build, and smooth shapes barely need ordering) faces are sorted by
  centre depth.
  The default fill is the theme's first series colour, lifted toward
  the paper in light mode; dark mode repaints with the dark palette.
- **Header** (the one inspector contract): click the model to reveal
  the header (language picker and a **view** picker: Isometric,
  Front, Right, Top) AND the code; click away to hide both. Dragging
  the model turns it. View and angle are presentation only, never
  saved.
- **Editing** the code redraws the model 600 ms after typing pauses;
  while it builds, the old drawing dims. A model inserted on an empty
  line takes that line's place.
- **Insert**: the palette's **Insert a 3D model (JSCAD)** adds a
  starter part (a block with a bore); "JSCAD (3D model)" is in every
  code block's language picker.
- **Print**: the model prints; the code does not (the header is
  hidden).
- **Data** (phase 2): the fence info `params=@table row=N` binds the
  model to a DATASET row (1-based; `row=` omitted means 1). The row's
  values override `getParameterDefinitions` defaults BY COLUMN NAME,
  so the script still runs standalone (on GitHub, or with no row).
  The header has a **data** picker ("No data" or `@dataset`) and a
  **row** picker ("Row 2: medium"), both writing the fence info
  (`params=` before `row=`). Editing the dataset redraws the models
  bound to it (`refreshDependents`: the one place a table's dependents
  redraw). A missing dataset or row is a Model error naming it.
- **Export STL** (phase 3): the header's **Export STL** writes the
  drawn faces as ASCII STL (`src/render/stl.ts`: a triangle fan per
  convex face, with normals, in model units), named `model-N.stl` or
  `<dataset>-rowN.stl`. The component emits `folio-export` and the host
  saves it: a native save dialog on the desktop (Tauri
  `save_text_file`), a download on the web.

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
