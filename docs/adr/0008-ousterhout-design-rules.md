# ADR-0008: Ousterhout's design philosophy governs module structure

Date: 2025-12-11
Status: accepted

## Context

John Ousterhout, *A Philosophy of Software Design* (2018), is the
reference text for application and component structure. Its central
claim: complexity is anything that makes software hard to change, and
it accumulates through dependencies and obscurity. Structure is the
primary defense.

## Decision

The following rules govern every module and component in folio.
Reviewers (architecture, ui-design) cite violations by rule number.

1. **Deep modules.** A module's value is the functionality it hides
   behind a small interface. `recalcTable(table) -> table` is the
   model: enormous complexity (parsing, evaluation, dependency
   tracking) behind one call. Flag modules that are shallow — wide
   interfaces wrapping trivial functionality.
2. **Information hiding.** Each module hides a design decision that
   could change: the engine hides the formula grammar and recalc
   strategy; the parser hides the directive-block syntax; the
   renderer hides the theme mechanics. If a change to a hidden
   decision ripples across modules, the leak is the defect.
3. **Narrow interfaces, few secrets per module.** Public surfaces
   are types + a handful of functions (see index.ts barrels). If a
   barrel exports more than ~10 symbols, ask whether the module is
   two modules.
4. **Pass-throughs are a smell.** If a component exists mainly to
   forward arguments to another component, merge or remove it.
5. **Symmetry and consistency.** Related things are done the same
   way everywhere: every block type implements the same lifecycle,
   every editor command the same pattern, every UI component the
   same states. Inconsistency is what the fussy-user and ui-design
   reviewers hunt.
6. **Comments where non-obvious, none where obvious.** Capture
   invariants and rationale (the "what" is in the code, the "why"
   goes in a comment), per Ousterhout's own rule and AGENTS.md.
7. **Define errors out of existence.** Prefer APIs that make misuse
   unrepresentable over those that throw for expected situations
   (e.g. typed columns make "letters in a number cell" a type-level
   concern, not a runtime error path).
8. **Working code isn't enough.** The most important thing is the
   long-term structure: it is cheaper to design a class right than
   to test bugs out. Where structure and short-term speed conflict,
   structure wins — this is an explicit ADR, agents must honor it.

## Consequences

- Review rubrics gain rule citations; findings reference the rule.
- Deep-module bias naturally limits public API surface, which also
  keeps golden/property tests small and stable.
- Splitting modules is encouraged when interfaces bulge; the
  architecture reviewer owns the judgment call.
