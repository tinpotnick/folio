# ADR-0010: Mermaid for diagram blocks

Date: 2026-10-18
Status: accepted

## Context

Diagrams are in the block schema (`kind: diagram`) but have no
renderer. Documents need flowcharts/sequence diagrams as semantic
blocks (markdown+). ADR-0007 requires a dependency note for every
new dependency: license, maintenance, and why existing deps do not
cover it.

## Decision

Add `mermaid` (MIT, very actively maintained, the de-facto standard
for markdown-embedded diagrams) as a runtime dependency, loaded via
dynamic import only when a document contains a diagram block - the
base bundle and offline rendering (ADR-0005) are unaffected: the
library is bundled, not fetched.

No existing dependency renders diagrams; writing a diagram renderer
from scratch is out of scope and unmaintainable.

## Consequences

- Diagram blocks render fully offline (bundle-included).
- `securityLevel: "strict"` (Mermaid's sanitizer on by default).
- The engine stays UI-free (ADR-0001): parsing/serializing diagram
  blocks is pure; rendering lives in the component.
