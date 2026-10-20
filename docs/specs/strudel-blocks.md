# Strudel code blocks

## Status: accepted (2026-11-14)

## Decision

Strudel (live-coding music, ADR-0014) is fully supported as a
language of the fenced code block: a fence tagged `strudel` renders
as a **figure with a player in its inspector**, not inert text.

## Contract

- **Model**: no new block kind. `{ kind: "code", lang: "strudel",
text }` - the existing fence block (docs/specs/
  code-blocks.md). Parser, serializer, and round-trip identity are
  untouched.
- **Render**: `figure.folio-strudel` (generated output:
  contentEditable false, selectable, Backspace/Delete removes it -
  the diagram affordance) containing the source as a themed
  `pre.folio-code` body plus the player inspector bar.
- **Inspector** follows the ONE inspector contract
  (docs/specs/figure-inspectors.md): reveal on a click inside the
  figure, hide on any click outside, Esc dismisses early, no close
  buttons. Contents: a Play button (first press lazily loads
  @strudel/web and evaluates the source; the click is the autoplay
  gesture), a Stop button (hush), and the source textarea (Enter
  applies, Shift+Enter newline). Evaluation errors render as an
  inline `Strudel error: ...` line - error as content, never a
  broken render (the diagram/math error contract).
- **Playing highlight**: while a pattern plays, each sounding
  mini-notation token flashes in the source body (driven by the
  haps' source locations via an onTrigger hook - audio stays
  audible) and a sweep bar tracks the live cycle position
  (scheduler.now() % 1) across the source. The flash spans and
  sweep bar are playback chrome: Stop removes them and restores
  the plain source text, and the structural sync never lets them
  reach the model.
- **Offline (ADR-0005)**: the library is bundled and lazily
  imported, never fetched. No sample banks are loaded; playback
  uses synthesized sound only.
- **Markdown view**: ```strudel fences highlight with the standard
  fence/code tokens - no new token kinds.
- **Toolbar**: a music-note button in the insert group
  (`#btn-strudel`). In document view it inserts a starter strudel
  block after the caret's block; in Markdown view it wraps the
  caret's paragraph in ```strudel fences (the code-button
  behavior).
- **Palette**: "Insert a Strudel music block" command reusing the
  toolbar button, keywords covering music/strudel/audio/beat.
- **Help**: the in-app help documents the feature in the SAME
  commit as the code (ADR-0009).

## The play-gesture contract (the play-does-nothing bug)

Web autoplay policy (strictest on WebKit - the desktop engine):
an AudioContext only runs when it is created AND resumed inside
a real user gesture. The library import is a heavy async
boundary, so a context created after `await import("@strudel/web")`
stays suspended forever - the clock never advances, and Play
does nothing. The fix is structural, not environmental:

- The play click SYNCHRONOUSLY creates (once) and resumes folio's
  own AudioContext, before the import runs, and hands it to
  `initStrudel({ audioContext })`.
- The Play button shows `Playing...` the moment it is clicked
  and reverts to `Play` on Stop or on any play error - the
  button can never look dead while the first load pays the
  import cost.
- The cycle sweep bar re-attaches after every highlight rebuild
  (the first token flash replaces the pre's children; the bar
  used to blink out of existence there).

Note for verification: automated WebKitGTK probes dispatch
synthetic clicks, which produce no user activation, so the
context stays suspended in the probe environment; the unlock is
pinned by the Chromium e2e and needs one real click on desktop
to confirm audibly.

## Acceptance

- `just lint`, `just test`, `just build` green; engine fence tests
  unchanged and passing (a strudel fence round-trips byte-identical).
- e2e: strudel fence renders a figure; source survives a view
  round-trip; the inspector reveals on click and hides on an
  outside click; editing prose around the figure preserves it;
  Enter on the figure does not split; Backspace on a selected
  figure removes it; the Markdown view fences with fence tokens;
  the play button starts audio without a network fetch.
- First-contact eval: evals/strudel-first-contact.md passes.
