#!/usr/bin/env bash
# How folio is being found and installed (docs/specs/package-repos.md,
# "Counting downloads"). Needs the GitHub CLI, logged in.
#
# - Release downloads: Windows, macOS, AppImage and direct downloads,
#   plus every Fedora `dnf install` / `upgrade` (dnf fetches the .rpm
#   from the release). Not counted: Flatpak and apt installs from
#   folio's own repositories (GitHub Pages keeps no logs).
# - Traffic: GitHub keeps the last 14 days only.
set -euo pipefail
REPO=${1:-tinpotnick/folio}

echo "Release downloads"
gh api "repos/$REPO/releases" --paginate --jq '
  .[] | select(.draft | not)
  | "  \(.tag_name)  (\(.published_at[:10]))",
    (.assets[] | "    \(.download_count | tostring | (" " * (6 - length)) + .)  \(.name)"),
    "    \([.assets[].download_count] | add | tostring | (" " * (6 - length)) + .)  total"'

echo
echo "Last 14 days"
gh api "repos/$REPO/traffic/views" --jq '"  page views   \(.count)  (\(.uniques) people)"'
gh api "repos/$REPO/traffic/clones" --jq '"  clones       \(.count)  (\(.uniques) unique; mostly CI)"'
echo "  top referrers:"
gh api "repos/$REPO/traffic/popular/referrers" --jq '.[] | "    \(.count)  \(.referrer)"'

echo
gh api "repos/$REPO" --jq '"Stars \(.stargazers_count)   forks \(.forks_count)   watchers \(.subscribers_count)   open issues \(.open_issues_count)"'
