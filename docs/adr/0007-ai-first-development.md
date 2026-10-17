# ADR-0007: AI-first development and dependency policy

Date: 2025-12-11
Status: accepted

## Context
Development is to be largely delegated to AI agents (implementer,
critique, UI, adversarial "picky user" agents). Constant human
steering is the failure mode to avoid.

## Decision
- Every subsystem gets a machine-checkable contract: unit tests,
  golden files (tests/golden/), property/fuzz tests (round-trip
  identity), screenshot diffs for rendering. If only a human can
  validate it, the contract is missing.
- Specs before code: a feature exists in docs/specs/ (with
  acceptance criteria) before implementation.
- Driver loop: agent implements task -> tests -> on failure feed
  errors back, max 3 attempts -> on stuck, STOP and write
  docs/blockers/<task>.md. Stop conditions are mandatory; thrashing
  is forbidden.
- Dependencies: never introduce a new dependency without an ADR
  noting license, maintenance, and why existing deps don't cover it.
  Known flags: HyperFormula and Handsontable are AGPL; AG Grid
  enterprise is commercial.

## Consequences
- Human role: specs, blocker triage, PR review. The loop does the rest.
- Eval set lives in evals/, grows from every real bug, runs in CI.
- The engine being UI-free (ADR-0001) is what makes agentic work on
  formulas/queries viable.
