# ADR-0001: Web-core stack

Date: 2025-12-11
Status: accepted

## Context
folio must run on web, desktop, and mobile with a rich custom editor
core, an embeddable editor (web component), and a computational table
engine.

## Decision
Web-core stack: Tiptap/ProseMirror editor core packaged as a
framework-agnostic web component. Desktop via Tauri, mobile via
Capacitor, direct web. Formula/query/recalc engine in Rust compiled
to WASM, consumed inside the component; engine has zero UI deps.

## Consequences
- One editor artifact serves all platforms and third-party hosts.
- Web is a first-class surface; SEO is a non-goal (app, not site).
- Mobile text editing in a WebView requires early, dedicated testing.
- Rust engine must be testable headlessly and exposed via WASM API.
