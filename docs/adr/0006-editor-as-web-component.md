# ADR-0006: Editor as embeddable web component

Date: 2025-12-11
Status: accepted

## Context
The editor must run in our own web/desktop/mobile apps and be
embeddable inside other applications.

## Decision
The entire editor (document model + UI + renderers) ships as a
framework-agnostic custom element (Shadow DOM, e.g.
<folio-doc src="...">) with a programmatic API: load/save, subscribe
to changes, get/set table data, headless chart SVG capture. Our own
apps are hosts of the same component. Shadow DOM keeps host styles
out and theme styles in.

## Consequences
- One artifact serves web, Tauri desktop, Capacitor mobile, and
  third-party hosts.
- The component API is also the outbound data surface: an embedded
  document is queryable as a data source.
- Host pages can't inject styles; theming must be complete (no gaps
  that force escape hatches).
