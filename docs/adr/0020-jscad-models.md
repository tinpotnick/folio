# ADR-0020: JSCAD 3D models as figures, in a sealed sandbox

Date: 2026-10-21

Status: accepted

## Context

A technical document wants drawings of parts, and the best drawings
are generated from a description, the way charts come from tables.
JSCAD describes solids in JavaScript and is widely used. But a JSCAD
script is ARBITRARY code, and folio's stance is "not a notebook, no
execution affordances, ever" (AGENTS.md). Its own viewer also needs
WebGL, which is the least dependable feature of WebKitGTK (the
Linux desktop app).

## Decision

- **A model is a figure, not a program.** A ```` ```jscad ```` fence
  renders automatically as its model, like a Mermaid diagram. There
  is no Run button. Editing the code redraws the model after a pause,
  and errors show as the figure's text. On GitHub it stays an
  ordinary JavaScript code block.
- **Sealed sandbox.** The script runs only in a dedicated Web Worker:
  no DOM, no access to the page or the desktop bridge, and with
  `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `importScripts`, IndexedDB, caches, channels and nested workers
  removed before any document code runs. `require` offers only
  `@jscad/modeling`. A script running past 5 seconds is terminated
  (the worker is replaced). Only faces come back.
- **SVG, not WebGL.** folio projects the faces itself
  (`src/render/mesh-svg.ts`): orthographic, back faces culled, flat
  shaded, far faces drawn first, in the theme's colours. The result
  is the same in Chromium, WebKitGTK and print/PDF, and it is
  testable. Drag turns the model, and the header offers preset
  views; neither is saved in the document.
- **Dependency:** `@jscad/modeling` 2.x, MIT licence, actively
  maintained (updated 2026-08). About 1.6 MB unpacked, bundled into
  the worker chunk, which loads only when a document has a model.
  Nothing is fetched at run time (ADR-0005).

## Consequences

- Documents cannot use JSCAD features that need the network or files
  (importing STL or SVG, remote libraries), by design.
- Painting order is exact (a BSP tree) up to 2,500 faces; above
  that it is approximate (centre depth), which is fine for smooth
  shapes. Meshes over 60k faces are refused with a hint to lower
  `segments`.
- Future phases: parameters driven by a dataset row, and STL export.
