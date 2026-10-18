# folio

A document-first workspace. Semantic Markdown documents where tables
are typed datasets, charts are queries over them, and the rendered
output reads like a polished report — not a notebook.

## Principles

- **Document-first.** The document is the artifact: prose, live
  tables, figures in one portable, offline-renderable file.
- **Semantic Markdown only.** No inline styling. Style lives in
  themes with a closed, typed schema.
- **Tables are typed datasets** — grid, dataset, and relation in one.
- **Charts are queries**, not widgets. Edit the table, the figure
  updates. No run buttons, no execution state.
- **Embeddable.** The editor is a framework-agnostic web component;
  our apps are hosts of it.
- **AI-first development.** Every subsystem has a machine-checkable
  contract. See AGENTS.md and docs/adr/.

## Repository layout

- `AGENTS.md` — standing orders for AI agents
- `docs/adr/` — architecture decision records (read before
  architectural changes)
- `docs/specs/` — specs, including the north-star sample document
- `docs/blockers/` — agent stop-and-report files
- `tests/golden/` — lossless round-trip golden files
- `evals/` — behavior eval set grown from real bugs

## Run it

```
npm install
npm run dev
```

Opens the demo host app: the sample document rendered as a polished
report — headings, prose, a live table (edit a cell and every
formula and the figure recalculate), and a chart generated from a
query over the table. Toggle to **Markdown** to see and edit the
source with code-editor highlighting; switch back to re-parse.
**Download .md** exports the doc. **☰ Sections** toggles the
section browser sidebar.

### Desktop app (Tauri)

The same UI as a native window with Open…/Save… file dialogs.

Prerequisites (one-time):

```bash
# Linux — the webview stack Tauri links against
# Debian/Ubuntu:
sudo apt install libwebkit2gtk-4.1-dev build-essential \
  libxdo-dev libssl-dev libayatana-appindicator3-dev \
  librsvg2-dev pkg-config
# Fedora:
sudo dnf install webkit2gtk4.1-devel gcc gcc-c++ \
  libxdo-devel openssl-devel libappindicator-gtk3-devel \
  librsvg2-devel pkgconf-pkg-config

# macOS — Xcode Command Line Tools (webview is built into macOS)
xcode-select --install

# Windows — Visual Studio C++ Build Tools (WebView2 is built into Windows 11;
# on Windows 10 install the WebView2 runtime from Microsoft)
```

Then run:

```bash
npm install
npm run dev:desktop    # opens the folio window with dev tools
npm run build:desktop  # bundles the installable app
```

What works in this first build:
- Document parse/serialize with lossless round-trip (golden-tested)
- Typed tables with formula columns (recalc on every edit)
- Charts as queries over tables (SVG, publication-oriented)
- Theme from document frontmatter (closed schema; no style literals
  ever live in the document)
- `<folio-doc>` web component: embed it anywhere (ADR-0006)- Section browser: a Word-style sidebar listing every section;  click to zoom to it, collapsible from the toolbar- Markdown source view with VS Code-style syntax highlighting  (frontmatter, headings, emphasis, code, table/chart directives)- Desktop app: a Tauri v2 host with native Open/Save (ADR-0006)

## Status

Milestone 1 complete (engine + round-trip + first usable app).
The recalc dependency graph (cross-table formulas, cycle detection)
is the next engine milestone.
