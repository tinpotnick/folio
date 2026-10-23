# Contributing to folio

Thanks for looking. folio is young; bug reports with the steps to
reproduce them are the most useful thing you can send. For anything
larger, open an issue first so we can agree on the approach.

## How the project works

- **[AGENTS.md](AGENTS.md)** holds the standing rules for anyone (human
  or AI) changing folio: the non-negotiables, and what "done" means.
- **[docs/adr/](docs/adr/)** records the architecture decisions and
  why they were made. Read them before changing anything structural;
  a new dependency needs an ADR.
- **[docs/specs/](docs/specs/)** describes each feature's behaviour.
  Behaviour changes update the spec in the same commit.
- **[evals/](evals/)** are first-contact evaluations: a new user must
  be able to complete each task using only what is on screen.
- **tests/golden/** keeps the document format lossless: parse then
  serialize must give the same bytes.

Principles, briefly:

- **Document-first.** The document is the artifact: prose, live
  tables and figures in one portable file that renders offline.
- **Semantic Markdown only.** No inline styling; style lives in
  themes with a closed, typed schema.
- **Tables are typed datasets; charts are queries** over them. No
  run buttons, no execution state.
- **Embeddable.** The editor is a framework-agnostic web component
  (`<folio-doc>`); the web and desktop apps are hosts of it.

## Run it

```bash
npm install
npm run dev            # the web app at http://localhost:5173
```

Repository layout: `src/engine` (parsing, formulas, queries - no UI),
`src/render` (themes, charts, highlighting), `src/component.ts` (the
`<folio-doc>` web component), `src/main.ts` (the host app), `demo/`
(the guide, help and example documents), `apps/desktop` (the Tauri
desktop host).

## Tests

```bash
just test             # unit tests (vitest)
just test-e2e         # end-to-end tests of the app (Playwright)
just test-webkitgtk   # the desktop engine (WebKitGTK), Linux only
just lint             # eslint + prettier
just build            # type-check + production build
```

Playwright starts its own dev server; install its browser once with
`npx playwright install chromium`. The WebKitGTK cases need
`npm run dev` running and PyGObject with WebKit2 4.1.

Every bug fix adds a test that fails before the fix.

## The desktop app (Tauri)

One-time prerequisites:

```bash
# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel \
  gcc gcc-c++ pkgconf-pkg-config
# Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential \
  libxdo-dev libssl-dev libayatana-appindicator3-dev \
  librsvg2-dev pkg-config
# macOS: Xcode Command Line Tools
xcode-select --install
# Windows: Visual Studio C++ Build Tools (WebView2 ships with Windows 11)
```

Plus Rust (https://rustup.rs). Then:

```bash
npm run dev:desktop    # the folio window, with dev tools
npm run build:desktop  # installers for this platform
```

Releases are built by CI for every platform; see
[docs/specs/releases.md](docs/specs/releases.md).

## Licence

By contributing you agree that your contributions are licensed under
the MIT licence ([LICENSE](LICENSE)).
