set shell := ["bash", "-c"]

default:
    @just --list

test:
    npm run test

lint:
    npm run lint

build:
    npm run build

ci:
    npm run ci

format:
    npm run format

agent TASK:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Starting agentic loop for task: {{TASK}}"
    echo "Loop: implement -> test -> fix (max 3 attempts)."
    echo "On repeated failure: stop and write docs/blockers/<task>.md per AGENTS.md."

verify-agent:
    #!/usr/bin/env bash
    set -euo pipefail
    just lint
    just test
    just build
    echo "All contracts green."
