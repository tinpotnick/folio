# Spell check and grammar

Date: 2026-11-12
Status: accepted

## Decision

folio leans on the **native browser/webview spell check** for the
document view — no bundled dictionary, no custom checker:

- The editing article renders with `spellcheck="true"` by default.
  The host can turn it off per component: `<folio-doc
spellcheck="false">` (attribute observed; reflected live onto the
  article). The demo host exposes the toggle as the palette command
  "Turn spell check off/on" (search "spell check").
- What that buys, per engine: misspelled words get the native red
  squiggle, and right-clicking one in **prose** opens the browser's
  native context menu with spelling suggestions (folio's custom
  context menu only intercepts table cells). The Markdown source
  view stays `spellcheck="false"` (it is markup, not prose).
- **Table cells**: squiggles show (spellcheck is inherited), but the
  cell's custom context menu replaces the native one, and no web API
  exposes suggestions — so suggestions are not reachable inside table
  cells. Accepted limitation of leaning on the native checker.

## Tauri / desktop engines

Native spell check is engine-dependent, and a web page cannot force a
webview to load a dictionary:

- **WebView2 (Windows, Chromium)** — full native spell check:
  squiggles and right-click suggestions.
- **WKWebView (macOS)** — WebKit's NSSpellChecker: works in editable
  content (squiggles + suggestions).
- **WebKitGTK (Linux)** — spell check only when the system provides
  enchant dictionaries; in minimal or bundled environments (AppImage)
  it is often absent, so squiggles may not appear. Best-effort; if
  Linux desktop spell check is required, the remedy is a bundled
  offline dictionary (e.g. nspell + Hunspell), which is a new
  dependency and needs its own ADR per ADR-0007 — deferred.

## Grammar: considered and deferred

There is **no web-platform API for grammar checking**. The options are
all costly:

- LanguageTool's hosted API — online, which conflicts with offline
  rendering (ADR-0005) unless behind explicit user consent (the
  ADR-0019 online-samples pattern).
- A local grammar model — a new, heavy dependency needing an ADR
  (license, maintenance) per ADR-0007.
- Browser on-device AI grammar — Chrome-only origin trials, not a
  standard.

So grammar checking is a recorded non-goal for now; revisit when a
standard on-device grammar API ships. Spell check (above) covers the
word-processor baseline.

## Acceptance

- e2e: the article renders `spellcheck=true` by default; setting /
  removing `spellcheck="false"` on `<folio-doc>` toggles it live
  (tests/e2e/editor.spec.ts).
- e2e: palette search "spell check" runs the toggle command
  (tests/e2e/palette.spec.ts).
- Help: the toggle is documented in demo/help/headings-links.md.
