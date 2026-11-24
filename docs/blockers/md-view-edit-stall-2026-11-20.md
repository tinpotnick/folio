# Blocker: source view uneditable ~20 s after switching, GPU-composited WebKitGTK only

## RESOLVED 2026-11-24

Root cause was none of the layout/paint theories below: the user had
the opt-in grammar check ON (`localStorage folio.grammar.v1`; the
harness profile has it off, hence no repro). 300 ms after the switch,
`computeSourceMarks` handed the WHOLE source - base64 audio included -
to Harper on the main thread: ~30 s measured in Node for the example,
~0.2 s with the payloads masked. Fixed by `maskForLint`
(src/spell/grammar.ts; spec: docs/specs/spellcheck-grammar.md,
"Grammar lint input is bounded"). The notes below are kept as history.

## Symptom (user, built Tauri app, Levantine Arabic example)

Open arabic example → switch to Markdown view: the markdown is VISIBLE
but clicking/typing does nothing for ~20 s, then it becomes editable.
Persisted across three fixes (see below). The WebKitGTK harness
(Broadway, software rendering) cannot reproduce it: switch handler
38–185 ms, no long tasks, a REAL GTK key lands in the editor < 1 s —
even for a synthetic 300-clip / 1.5 MB doc.

## What was tried (all pushed to vibe/flashcards-mockups-092eb7, PR #182)

1. `c6f3eb8` — no soft wrap (`wrap="off"`, `white-space: pre`), data-URI
   audio `preload="none"`, `pauseMedia()` on leaving doc view. Harness:
   switch 42–61 ms. User: still ~20 s.
2. `05939f0` — lazy audio widgets, editor height synced from overlay.
3. `d36229b` — overlay rows > 1024 chars render truncated prefix +
   `…(+N)` marker; caret line renders full. Overlay on the example:
   ~40 k → ~10 k chars. User: still ~20 s.
4. `f4c09ef` — data chips: any `data:<mime>;base64,<payload>` > 128
   chars renders as a chip (`tk-data`, mime + size); caret line expands
   to raw. Overlay now ~2.4 k chars, max row 71. User: "better anyway,
   but the problem persists".
5. Probes that found NOTHING slow in the harness: media teardown with 8
   clips playing before the switch (50 ms, no long tasks); 300-clip
   1.5 MB doc (185 ms); spellcheck is `spellcheck="false"` on the
   textarea; the bundled checker skips directive lines and > 4096-char
   tokens; Tauri `fetch_url` (30 s timeout) is only for remote open-
   data imports, not this path.

## Current hypothesis

The remaining un-bounded layer is the TEXTAREA itself: it holds the
full 40 kB including 8 single lines of up to 6.4 k chars, and until
this change it was also grown to the full content height (up to ~31 k
px for 300 clips), so its layer/scrollable area is enormous. On
GPU-composited WebKitGTK (DMABUF) that plausibly stalls raster/caret
hit-testing for seconds; under Broadway software rendering it does
not. Fix in progress: the source view is now a fixed-height box
(`height: calc(100vh - 100px)`); the textarea scrolls internally and
the overlay/gutter are panned in sync on both axes, so no layer ever
exceeds the viewport. Print is unaffected (`@media print` hides
`#md-wrap`).

## What would unblock this definitively

A trace from the user's real app. The btn-markdown handler now records
`window.__folioMdSwitch = { handlerMs }` (time from click until two
frames painted). With the WebKitGTK inspector open (debug build,
F12/right-click → Inspect) the user can:

- read `__folioMdSwitch` after switching (if handlerMs is ~20 000, the
  block is in the switch handler itself — getMarkdown/pauseMedia/
  renderHighlight; if it is small, the block is after it: paint,
  layout, or first input);
- record a Performance profile across the switch and the first click;
- check `performance.getEntriesByType("longtask")` after the switch.

If handlerMs is small and longtasks are empty but editing still lags,
the cost is engine-internal (textarea layout/hit-test under
accelerated compositing) and the next lever is to keep huge lines out
of the textarea's layout entirely (e.g. section-windowed source view),
which is a much bigger change and needs a product decision.
