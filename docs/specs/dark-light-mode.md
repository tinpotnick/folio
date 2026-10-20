# Dark and light mode

## Status: accepted (2026-10-20)

## Decision

Dark mode dresses the APP CHROME - toolbar, section browser,
Markdown source editor, status bar, palette and settings modals.
The DOCUMENT stays paper: a folio document's look comes from its
own theme (closed schema, ADR-0002), never from the app around it,
so switching modes never changes what the document is. Like a
page previewed against a dark desk.

## Contract

- **One switch, three entry points**: the moon button beside
  Help, the palette command "Toggle dark mode", and the
  persisted choice. `document.documentElement.dataset.mode`
  holds `light` or `dark`.
- **Before first paint**: a tiny `<head>` script sets the
  attribute from localStorage (`folio:mode`), falling back to
  the system `prefers-color-scheme` - dark-preference users never
  see a flash of light.
- **CSS variables**: every chrome color is a custom property on
  `:root`, overridden by `html[data-mode="dark"]` - surfaces,
  text, borders, the accent pair, the Markdown syntax palette,
  the record pulse. The document's shadow-root styles are
  untouched by design.
- **The button says which way it goes**: "Switch to dark mode" /
  "Switch to light mode" (title and aria-label swap with the
  mode).

## Acceptance

- e2e: `tests/e2e/mode.spec.ts` (default light, button flip,
  persistence across reload, palette entry, the document stays
  paper in dark mode).
- First-contact eval: `evals/dark-light-first-contact.md`.
