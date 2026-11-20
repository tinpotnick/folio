#!/usr/bin/env bash
# Regenerates the stats example (demo/examples/stats.md) from live
# GitHub data: per-day page views and clones (the traffic API keeps
# only the last 14 days) plus per-release download counts. The daily
# rows are merged into a CSV history so the doc's trend outlives that
# window; the CSV lives on the `stats` branch (pushed by the nightly
# stats workflow, .github/workflows/stats.yml), never on main.
# Needs the GitHub CLI, logged in.
#
# Usage: scripts/stats-doc.sh [CSV] [OUT]
#   CSV  history file, created if missing (default /tmp/folio-traffic.csv)
#   OUT  document to write            (default demo/examples/stats.md)
#
# Env:
#   STATS_HISTORY_ONLY=1  do not call the traffic API (it needs
#     "Administration: read", which GITHUB_TOKEN cannot be granted);
#     re-emit the document from the stored CSV history only. Used by
#     the pages workflow so a push to main does not redeploy the stale
#     seed over the live stats. The nightly stats workflow still
#     refreshes the 14-day API window and rewrites the CSV.
set -euo pipefail
REPO=${REPO:-tinpotnick/folio}
CSV=${1:-/tmp/folio-traffic.csv}
OUT=${2:-demo/examples/stats.md}

# --- collect -------------------------------------------------------------

touch "$CSV"
if [ "${STATS_HISTORY_ONLY:-0}" = "1" ]; then
  : # traffic history comes from the CSV as stored; nothing to collect
else
  VIEWS=$(gh api "repos/$REPO/traffic/views" \
    --jq '[.views[] | {date: .timestamp[:10], views: .count, views_uniques: .uniques}]')
  CLONES=$(gh api "repos/$REPO/traffic/clones" \
    --jq '[.clones[] | {date: .timestamp[:10], clones: .count, clones_uniques: .uniques}]')

  # --- merge the 14-day API window over the CSV history ----------------
  # Days inside the window are refreshed from the API; older days keep
  # their recorded values.

  MERGED=$(jq -rn --argjson v "$VIEWS" --argjson c "$CLONES" --rawfile csv "$CSV" '
    ($c | map({key: .date, value: .}) | from_entries) as $clones |
    [$v[] | . + ($clones[.date] // {})] as $days |
    ($days | map(.date)) as $newdates |
    ($csv | split("\n") | map(select(length > 0)) | .[1:]
      | map(split(",")
        | {date: (.[0] | gsub("\""; "")), views: (.[1] | tonumber),
           views_uniques: (.[2] | tonumber), clones: (.[3] | tonumber),
           clones_uniques: (.[4] | tonumber)})) as $old |
    ([$old[] | select(.date as $d | $newdates | index($d) | not)] + $days
      | sort_by(.date))
    | .[] | [.date, (.views // 0), (.views_uniques // 0), (.clones // 0),
             (.clones_uniques // 0)] | @csv')

  {
    echo "date,views,views_uniques,clones,clones_uniques"
    printf '%s\n' "$MERGED"
  } > "$CSV"
fi

# The releases list is public - readable with the default GITHUB_TOKEN.
RELEASES=$(gh api "repos/$REPO/releases" --paginate --jq '
  [.[] | select(.draft | not)
    | {release: .tag_name, published: .published_at[:10],
       downloads: ([.assets[].download_count] | add // 0)}]
  | sort_by(.published)')

TRAFFIC_ROWS=$(jq -rn --rawfile csv "$CSV" '
  $csv | split("\n") | map(select(length > 0)) | .[1:] | map(split(","))
  | .[] | "  - [\(.[0] | gsub("\""; "")), \(.[1]), \(.[2]), \(.[3]), \(.[4])]"')
DL_ROWS=$(jq -rn --argjson r "$RELEASES" '
  $r[] | "  - [\"\(.release)\", \(.published), \(.downloads)]"')

# --- emit the document ----------------------------------------------------

{
  cat <<'HEAD'
---
theme: newsroom
---

# folio's own numbers

This document is folio's own GitHub repository rendered by folio: a
typed table snapshotted from the API, charts as queries over it, no
run button. GitHub keeps only the last 14 days of traffic, so a
nightly workflow (`.github/workflows/stats.yml`) appends each day to
the history below - the trend outlives the API's window. The document
is a static snapshot and renders fully offline.

## Daily traffic

::: table {#traffic}
caption: "Page views and clones per day (GitHub traffic API, snapshotted nightly)"
columns:
  - {name: date, type: date, align: right}
  - {name: views, type: number, align: right}
  - {name: views_uniques, type: number, align: right}
  - {name: clones, type: number, align: right}
  - {name: clones_uniques, type: number, align: right}
data:
HEAD
  printf '%s\n' "$TRAFFIC_ROWS"
  cat <<'MID'
:::

::: chart {#views-chart}
source: @traffic
query: {select: [date, views], sort: {by: date, order: asc}}
type: line
caption: "Page views per day"
:::

::: chart {#clones-chart}
source: @traffic
query: {select: [date, clones], sort: {by: date, order: asc}}
type: line
caption: "Clones per day (mostly CI)"
:::

## Release downloads

::: table {#downloads}
caption: "Downloads per release, all assets (dnf installs included via the .rpm)"
columns:
  - {name: release, type: text, width: 20}
  - {name: published, type: date, align: right}
  - {name: downloads, type: number, align: right}
data:
MID
  printf '%s\n' "$DL_ROWS"
  cat <<'TAIL'
:::

::: chart {#downloads-chart}
source: @downloads
query: {select: [published, downloads], sort: {by: published, order: asc}}
type: bar
caption: "Downloads per release, oldest first"
:::
TAIL
} > "$OUT"

echo "wrote $OUT ($(grep -c '^  - \[' "$OUT") table rows) and $CSV"
