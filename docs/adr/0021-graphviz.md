# ADR-0021: Graphviz for drawn DOT blocks

Date: 2026-10-21

Status: accepted

## Context

Mermaid (ADR-0010) covers flowcharts and sequence diagrams, but its
layouts struggle with real graphs: dependency trees, state machines,
networks. Graphviz is the standard for those, and DOT is widely
known.

## Decision

Draw ```` ```dot ```` / ```` ```graphviz ```` blocks with
**`@viz-js/viz`** 3.x: Graphviz compiled to WebAssembly, with the
binary embedded in the JavaScript.

- **Licence:** MIT for the package; Graphviz itself is EPL-1.0, which
  permits redistribution in compiled form. No AGPL or commercial
  terms.
- **Maintenance:** active (3.31, September 2026); it tracks Graphviz
  releases (16.x).
- **Size:** about 5 MB unpacked (the WASM is inline). Loaded only on
  a document's first DOT diagram (a lazy import, like Mermaid and
  KaTeX), and nothing is fetched at run time (ADR-0005).
- **Safety:** DOT is a description, not a program; no document code
  runs. The SVG output is sanitized (docs/specs/drawn-blocks.md),
  because DOT `URL` attributes become links.
- **Alternatives:** `@hpcc-js/wasm-graphviz` (Apache-2.0) is smaller
  but loads its WASM as a separate fetch, which is an extra asset path
  for the desktop bundle. Mermaid cannot lay out general graphs.

## Consequences

- One more lazy chunk in the build.
- Graphviz sizes text with its own metrics, so labels in the theme's
  face can run close to their borders; the theme adds node margin.
