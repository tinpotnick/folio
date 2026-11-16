# ADR-0033: Bundled proofing — nspell spell check and Harper grammar

Date: 2026-11-12

Status: accepted

## Context

folio is a word processor, so it needs spell check (and grammar) that
works everywhere it runs — including the Tauri desktop app. The
native webview spell check (set via `spellcheck="true"` on the
article) is engine-dependent: full in Chromium/WebView2 (Windows) and
WKWebView (macOS), but WebKitGTK (Linux, the Tauri engine this repo
bundles as an AppImage) only spellchecks when the _system_ provides
enchant dictionaries, which minimal/bundled environments often lack.
Native spell check also cannot offer suggestions inside folio's own
table-cell context menu (no web API exposes suggestions), and it is
not assertable in tests. Grammar has no web-platform API at all.

## Decision

Bundle both proofers with the component (offline per ADR-0005; new
dependencies noted per ADR-0007):

- **Spell check: nspell 2.1.5 (MIT, 42 KB) over the vendored Hunspell
  en_US dictionary** (`src/assets/dict/en_US.{aff,dic}`, 552 KB,
  49,568 words, from LibreOffice/dictionaries — SCOWL/wordlist by
  Kevin Atkinson under a BSD-style permissive grant, aff file BSD;
  notice in `src/assets/dict/LICENSE.en_US.txt` and
  THIRD_PARTY_NOTICES.md). The dictionary ships as a build asset
  (`?url` imports) fetched lazily on first use; nothing is fetched
  from the network at runtime. nspell is deterministic across OSes,
  so marks and suggestions are identical everywhere and testable in
  CI. Native `spellcheck` stays OFF on the article so squiggles never
  double up; `<folio-doc spellcheck="false">` turns the bundled
  checker off entirely. Custom ("add to dictionary") words persist
  per origin in localStorage. Marks are spans the DOM→markdown sync
  unwraps, so the model is never touched.
- **Grammar: harper.js 3.x (Apache-2.0)**, Harper's Rust core compiled
  to WASM. Fully offline, privacy-first, English-only today. The slim
  binary (~20 MB wasm, ~8 MB gzip) is a lazy chunk
  (`import("harper.js/slimBinary")`; vite emits the .wasm as a separate
  asset) fetched only when the user turns grammar check on (opt-in,
  persisted per origin) — it never weighs the default load. If Harper
  proves very usable we may bundle it eagerly later; the lazy chunk
  keeps that door open. LanguageTool (MPL/LGPL) needs a JVM or a
  hosted server — rejected for a webview (online violates ADR-0005
  unless consent-gated per ADR-0019). textlint is rule-based style, not
  grammar. No AGPL dependency is introduced (ADR-0007 flag).

## Consequences

- Squiggles + right-click suggestions (and grammar marks + apply)
  work identically in browser and desktop, Linux included, and in
  table cells (folio's own menus now carry them).
- Print/PDF suppresses the marks (CSS), like native spell-error.
- Bundle cost: +42 KB (nspell) eager, +~550 KB dict asset fetched on
  first render, +~20 MB wasm asset only on grammar opt-in.
- Spec: docs/specs/spellcheck-grammar.md (rewritten from the
  native-only decision).
