# ADR-0009: Usability and documentation are invariants

Date: 2025-12-11
Status: accepted

## Context

folio must be usable enough that a help system is rarely needed —
but "needs no help" is a direction, not an achievable state. At the
same time, in an AI-first repo the documentation IS the spec agents
implement from: doc drift is not cosmetic, it corrupts the loop.

## Decision

### Usability: the three-layer contract

1. **Discoverability in the artifact.** Everything visible, nothing
   hidden behind modes; empty states teach; every block type is
   visibly editable in place. The target: a new user completes core
   tasks with no instructions.
2. **Inline, contextual help.** Help appears where confusion is:
   a formula cell shows referenced columns on focus; a chart block
   previews its query result while edited. Invest here first — it
   scales with features for free.
3. **Escape hatch.** A reference/help surface, needed less and less
   as layers 1-2 improve.

Enforcement: every new user-visible feature ships with a
**first-contact eval** — a scripted task an agent (playing a new
user, without instructions) must complete using only visible
affordances. No passing eval, feature is not done. Eval cases live
in evals/ and run in CI like any other test.

### Documentation: docs ride the commit

A change that alters user-visible behavior must update the
corresponding doc (spec in docs/specs/, README, or help text) in
the same commit. A change without its doc update is incomplete;
reviewers reject it. Help content stays close to the feature it
describes, ideally as structured content beside the code (and
long-term, help docs are themselves folio documents).

## Consequences

- The fussy-user reviewer gains first-contact eval checks; the
  ui-design reviewer owns layer-1 affordances; the testing reviewer
  rejects doc-drift commits.
- evals/ grows with every feature; CI runtime must stay lean
  (eval cases are scripted checks, not free-form model calls).
- Adding a feature is now strictly more work — deliberately.
