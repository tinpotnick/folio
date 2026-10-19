# ADR-0011: KaTeX for equations

Date: 2026-10-18
Status: accepted

## Context

Equations are content, not styling: scientific and technical
documents need display math as a semantic block (markdown+, like
tables and diagrams). LaTeX is the authoring notation users
already know. ADR-0007 requires a dependency note for every new
dependency: license, maintenance, and why existing deps don't
cover it.

## Decision

Add `katex` (MIT, very actively maintained, the de-facto standard
for LaTeX rendering on the web - MathJax's closest competitor with
synchronous rendering and a much smaller bundle) as a runtime
dependency, loaded via dynamic import only when a document
contains a math block - the same pattern as mermaid (ADR-0010).
The base bundle and offline rendering (ADR-0005) are unaffected:
the library and its CSS are bundled, never fetched. The CSS is
injected into the component's shadow root (vite `?inline`) so the
scoped tree styles itself.

No existing dependency renders math; writing a TeX renderer is out
of scope and unmaintainable.

## Consequences

- Math blocks render fully offline (bundle-included).
- `throwOnError: false`: bad LaTeX renders the error inline in the
  document instead of crashing the render; the error is visible
  text, matching the diagram error contract.
- No `trust` extensions: KaTeX's default denies `\href` etc.
- The engine stays UI-free (ADR-0001): parsing/serializing math
  blocks is pure; rendering lives in the component.
- Display math first (`$$` blocks, kind: math). Inline `$...$`
  notation is a later extension (it collides with prose dollar
  signs and needs care).
