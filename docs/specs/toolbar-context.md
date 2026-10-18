# Toolbar context state and Markdown-view actions

## Status: accepted (2026-10-18)

## Decision

The block/format toolbar (H1, H2, P, B, I, code) reflects the context
at the caret and acts on it — in BOTH views. Before this, the active
state only computed (and, untested, never displayed) in document
view, and the buttons were inert in Markdown view.

## Contract

- **Document view (state):** on caret/selection change, the block
  button matching the caret's block element (H1/H2/P) and the inline
  buttons matching the selection (`queryCommandState`, `PRE` for
  code) get the `active` class. `index.html` styles `.fmt
  button.active` (dark chip, like the view switch).
  - The real selection anchor comes from
    `el.shadowRoot.getSelection()` — `document.getSelection()` is
    adjusted to the light DOM when the caret is inside the shadow
    root, which made the old reflection code see nothing.
- **Markdown view (state):** the block buttons reflect the current
  line's prefix (`# ` → H1, `## ` → H2, otherwise P); the inline
  buttons reflect the token kind at the caret via
  `highlightMarkdown` (bold / italic / code).
- **Markdown view (actions):** mousedown on the toolbar acts on the
  source at the caret:
  - H1/H2/P sets or removes the line's heading prefix.
  - B / I / code toggles `**`, `*`, or backticks around the
    selection (or the word at the caret). Toggling off removes the
    markers when both sides carry them.
  - The document re-parses on the next switch to document view; the
    document remains the single source of truth.
- Outside both views the buttons stay unlit and flash
  "Click into the text first" when pressed.

## Acceptance

- `just lint`, `just test`, `just build` green; e2e in
  `tests/e2e/app.spec.ts` ("toolbar context state and actions").
- First-contact eval: `evals/toolbar-context-first-contact.md`.
