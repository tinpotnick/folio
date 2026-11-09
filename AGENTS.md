# AGENTS.md — Standing orders for AI agents working on folio

## Product in one line

A document-first workspace: semantic Markdown documents where tables
are typed datasets, charts are queries over them, and the rendered
output reads like a polished report. Not a notebook — no execution
affordances, ever.

## Non-negotiables (see docs/adr/)

1. Markdown is semantic only. NO inline styling in documents, ever.
2. Style lives in themes; the theme schema is closed and typed.
3. Documents must render fully offline — external bindings are
   snapshot + metadata, never a render dependency.
4. The document model round-trips losslessly (golden tests in
   tests/golden/ must stay byte-identical).
5. The engine (parsing, formulas, queries, recalc) has ZERO UI
   dependencies and is testable headlessly.
6. The editor ships as a framework-agnostic web component; our own
   apps (web, desktop, mobile) are hosts of that component.

## Definition of done

- All tests pass (`just test`), lint and build are green (`just lint`, `just build`)
- New public behavior has a spec entry in docs/specs/ and, if
  user-visible, an eval case
- Every user-visible change ships a first-contact eval that passes
  (ADR-0009): an agent playing a new user completes the core task
  using only visible affordances
- Every new user-visible action is a command-palette entry and an
  in-app-help entry, in the SAME commit — the palette is the menu;
  a feature that cannot be found by searching for words the user
  already knows is not done
- Behavior changed? The corresponding doc (spec/README/help) is
  updated in the SAME commit — doc drift makes the change incomplete
- Every bug fix adds a test that fails before the fix
- If stuck after 3 attempts: STOP. Write docs/blockers/<task>.md with
  the exact failure and what you tried. Do not thrash.

## Working rules

- Read docs/adr/ before touching anything architectural.
- Review the spec, not the diff, when unsure of intent.
- Never introduce a dependency without checking ADR-0007.
- Every inspector bar (table, chart, equation, diagram, and any
  future one) follows ONE contract: reveal on a click inside its
  figure, hide on any click outside it, Esc dismisses early, no
  close buttons. See docs/specs/figure-inspectors.md - do not
  add per-inspector dismissal special cases.
- Specs live in docs/specs/; the sample document is the north star.
- Chrome CSS traps (learned in PR #138 - see docs/reviewers/
  ui-design.md for the full list): src/render/theme.ts builds CSS in
  ONE template literal, so no backticks in its comments; shared
  control rules set font-family/font-size explicitly, never the
  `font:` shorthand (it resets font-style and outranks class rules
  by specificity); icons added to an inspector bar leak into
  `figure svg` test locators, so scope those to `.chart-holder`;
  structural table edits go through applyTableAction, which
  commits+blurs the caret cell first (the re-render's removal-blur
  otherwise writes the stale cell into the shifted model); never
  color table header TEXT with the accent (banded themes fail
  contrast - use a ring/underline and tint the cells); in e2e, after
  a structural edit, dispatch `contextmenu` on the exact cell
  locator because the bar-reveal scroll shifts real right-clicks.
