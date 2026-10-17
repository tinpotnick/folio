# Code reviewers (AI agents)

Each reviewer is a model session with a fixed rubric. Driver loop
usage: implement -> run reviewers -> file findings as markdown under
docs/critiques/ -> implementer addresses findings. Reviewers never
edit code; they report.

## Roster

| Reviewer | File | Scope |
|---|---|---|
| architecture | architecture.md | ADR compliance, layering, engine/UI separation |
| ui-design | ui-design.md | component reuse, consistency, visual coherence |
| fussy-user | fussy-user.md | adversarial UX: edge cases, weird input, rage clicks |
| testing | testing.md | coverage of contracts, golden/property tests, test quality |
| security | security.md | injection, formula sandboxing, external bindings, pen-test angle |

Add a reviewer by adding a file here; the roster table is the source
of truth. Every reviewer reads AGENTS.md first.
