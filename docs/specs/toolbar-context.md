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
  buttons matching the selection get the `active` class. `index.html`
  styles `.fmt button.active` (dark chip, like the view switch).
  - Inline detection is **semantic**: the caret's ancestors are
    walked for `STRONG`/`EM`/`CODE`. `queryCommandState` is NOT used:
    it reports rendered boldness (headings render bold — which lit B
    on H1 lines) and differs between engines (Chromium vs WebKit,
    i.e. web vs desktop).
  - The selection anchor is resolved robustly across engines, in
    order: `shadowRoot.getSelection()`, `document.getSelection()`
    (Chromium adjusts it to the light DOM when the caret is in the
    shadow root), `Selection.getComposedRanges()` where present, and
    — for pointer-driven updates — `shadowRoot.elementFromPoint()`
    at the pointer position. WebKitGTK (the Tauri engine, verified
    against 2.54 via MiniBrowser + WebKitWebDriver) exposes no
    selection or caret API that pierces the shadow boundary at all;
    its shadow-root hit testing is the only source that does.
  - **Arrow-key tracking (caret hint):** engines without a pierceable
    selection API track the caret via a hint. Clicks resolve the
    block element exactly (hit-testing through the shadow root);
    ArrowUp/ArrowDown move across the article's block elements
    using their readable geometry — block rects and the first line
    box — crossing to the previous/next block when the caret leaves
    the first/last line. The toolbar reflects the block at the
    hint. Verified in WebKitGTK: ArrowUp from the first paragraph
    line lights H1 (with inline buttons disabled), ArrowDown
    returns to P. Chromium ignores the hint (its shadow selection
    is read directly, so it also tracks every other key).
  - **Inline buttons disable on complete block formats:** when the
    caret's block is a heading (H1–H6) or a code block (`PRE`), the
    B/I/code buttons are disabled — the markdown carries no inline
    emphasis inside them, so they neither light up nor act there.
- **Markdown view (state):** the block buttons reflect the current
  line's prefix (`# ` → H1, `## ` → H2, otherwise P); the inline
  buttons reflect the token kind at the caret via
  `highlightMarkdown` (bold / italic / code). Inline buttons are
  disabled on lines starting with `#` — the same rule as document
  view.
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
