set shell := ["bash", "-c"]

default:
    @just --list

test:
    npm run test

test-e2e:
    npm run test:e2e

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

# The Linux desktop's real engine (WebKitGTK); needs `npm run dev`.
test-webkitgtk:
    python3 tests/webkitgtk/run.py

# How folio is being found and installed: release downloads (including
# Fedora dnf installs), 14-day traffic, stars.
stats:
    scripts/stats.sh
