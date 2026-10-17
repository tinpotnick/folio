# evals/

Behavior eval set (ADR-0007, ADR-0009). Each eval is a scripted
scenario with expected outcomes, run in CI. Grown from:
- first-contact evals for every user-visible feature
- real bugs (each bug found becomes an eval case)

Naming: <feature>-<scenario>.md with frontmatter (name, feature,
steps as data) — the runner (TBD) executes them mechanically.
