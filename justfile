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

# The Linux desktop's real engine (WebKitGTK), headless; needs
# `npm run dev`. Name cases to run only those; FOLIO_WEBKITGTK_VISIBLE=1
# shows the windows.
test-webkitgtk *cases:
    python3 tests/webkitgtk/run.py {{cases}}

# How folio is being found and installed: release downloads (including
# Fedora dnf installs), per-day traffic for the last 14 days, stars.
# The nightly stats page on the live site: scripts/stats-doc.sh +
# .github/workflows/stats.yml (docs/specs/package-repos.md).
stats:
    scripts/stats.sh
