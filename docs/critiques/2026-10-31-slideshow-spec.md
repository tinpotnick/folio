# Critique: docs/specs/slides.md + docs/adr/0031-slideshow-view.md

Reviewer pass over the slideshow proposal against the five reviewer
rubrics (docs/reviewers/), AGENTS.md non-negotiables, and the accepted
ADRs. The proposal files are untracked; findings reference them by
section.

## Blocker — RESOLVED in spec (owner-approved 2026-10-31)

- **Desktop PDF export hard-coded A4.** `apps/desktop/src-tauri/src/lib.rs:337`
  called `page.set_paper_size(&gtk::PaperSize::new(Some("iso_a4")))` and
  `pdf_furniture.rs:94` pinned 595x842 pt, while the spec promised 16:9
  pages when printing from play mode. Resolution: paper size is not a
  constant anywhere - it becomes a closed style key `page.size`
  (default `a4`) read by all three hard-coded sites (print stylesheet
  `@page` at index.html:1400, desktop PageSetup, furniture stamper
  fallback); while slide rendering is on, the session's effective
  `page.size` is the slide aspect (`16:9` from the theme's
  `slide.aspect`). A raw Markdown file with no key assumes A4, an
  acceptable default.

## Major

- **Play is not discoverable (ADR-0009 layer 1, ui-design rubric 7).**
  A toolbar play button is proposed, but ADR-0009's target is "a new
  user completes core tasks with no instructions" and AGENTS.md makes
  the palette + in-app-help entries mandatory — both are listed only
  under "when implemented." The spec should state the discoverability
  contract up front, and consider an empty-state affordance: a document
  with 2+ H1s could surface "Play as slides" inline. Without that,
  the first-contact eval will fail by construction.
- **Play-vs-edit ambiguity (ADR-0008 rule 5, symmetry).** While
  playing, the document view is still contenteditable. The spec says
  editing "works exactly as in document view," but says nothing about
  what arrow keys / click-to-advance do to a caret, or whether typing
  mid-play is allowed. Either play mode disables text editing (like
  print normalization disables source view) or the spec must define
  the interaction. As written this is the kind of inconsistency the
  fussy-user reviewer hunts: arrow keys move the caret in document
  view but advance slides in play mode — same keys, two meanings.
- **Slide counter / section browser behavior while playing is
  underspecified (fussy-user attack list #4).** "n of N" in the status
  bar and section-browser entries are proposed, but what happens on
  rage-click advance past the last slide, on a 10k-H1 document, or
  when an H1 is deleted mid-play (counter, fullscreen, focus)? Spec
  needs the edge cases named even if the answer is "wrap" / "clamp."
- **TOC one-H1 rule flip-flops between views (ADR-0008 rule 5).** The
  spec overrides the contents list's "exactly one H1 is the title"
  convention only while slide rendering is on. A document with one
  H1 shows it as title in document view but as slide 1 of 1 while
  playing — the same document, two TOC semantics, toggled by a
  session flag. Acceptable, but it must be an explicit, documented
  decision (it is, here) and tested in e2e, or it will read as a bug.

## Minor

- **"Slide overflows" marker has no owner.** The status bar is host
  chrome (src/main.ts), but the overflow measurement is component
  (shadow DOM scrollHeight vs slide height). The spec should name who
  computes it and how it's communicated (component attribute, e.g.
  `slides="overflow"` alongside the existing `mode` attribute at
  src/component.ts:6433, read by the host) — otherwise the host never
  learns about it.
- **16:9 vs theme aspect.** `aspect-ratio: 16/9` is hard-coded in the
  spec; per ADR-0002 the ratio belongs in the closed theme schema
  (e.g. `slide.aspect: 16/9 | 4/3`), defaulting to 16/9, so a 4:3 deck
  theme is possible without a code change.
- **Print from source view while playing.** `preparePrint`
  (src/main.ts:3591) switches out of Markdown view before printing;
  the spec says slide rendering "stays on if it was on," but play also
  implies fullscreen — spec should state print exits fullscreen first.
- **Testing reviewer:** acceptance is good (byte-identical save is the
  right property test), but add a golden-style fixture: a small deck
  document rendered with slide rendering on/off must serialize
  identically (model untouched) — that's the load-bearing invariant of
  the whole proposal and deserves a named test, not just an e2e.
- **Security reviewer:** no new attack surface — no new parsing, no
  bindings, no dependencies (ADR-0007 clean). Slide rendering is pure
  CSS over existing blocks; the only new input is the H1 count, which
  is already bounded by document size. Clean.

## What holds up well

- **Model untouched by construction** is the strongest point: no
  frontmatter, no block kinds, golden tests unaffected, save
  byte-identical. This is exactly ADR-0002/ADR-0005 discipline —
  display in the session, semantics in the file.
- **No-windowing rule** correctly identifies the one real technical
  landmine (syncFromDom over a partial DOM) and defuses it.
- **Print pipeline reuse** (beforeprint normalization + `@page`)
  avoids a second export engine, matching ADR-0025's "one rendering
  path" decision.
- **H1-means-slide-uniformly** avoids a title/slide duality that
  would have rippled into TOC, section browser, cross-references and
  file naming.

## Verdict

Sound concept, correctly scoped. The desktop-A4 blocker is resolved
by making paper size a style key (`page.size`, default `a4`) instead
of a constant; the discoverability gap (ADR-0009) is now specified.
Ready to move from proposed to accepted when implementation starts.

## Follow-up pass (2026-10-31, post-resolution): remaining work

All findings above are now addressed in the spec. What remains is
implementation-time checklist, not open design questions:

1. `page.size` style key: schema entry + settings dropdown
   (fillSettings, src/main.ts:3483) + `@page` emission (index.html)
   + desktop PageSetup and furniture-stamper reads.
2. Slide rendering flag on the document view (attribute, like `mode`
   at src/component.ts:6433) + toolbar play button + palette entries.
3. `slide.*` theme keys (background, aspect, title/body size, image
   mode) in the closed schema; deck theme presets.
4. `beforeprint` gains "keep slide rendering on" + exit fullscreen.
5. H1 always breaks in paged output while playing; page furniture
   suppressed on slides.
6. Help topic demo/help/slides.md + index entry; first-contact eval;
   e2e (tests/e2e/slides.spec.ts); golden-style byte-identity test.
No open blockers, majors, or minors remain in the spec.
