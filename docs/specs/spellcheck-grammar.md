# Spec: bundled spell and grammar checking

Status: implemented (ADR-0033). Supersedes the native-spellcheck-only stance
of the earlier draft of this spec.

## Why bundled

- Native `contenteditable` spellcheck is unavailable or unreliable in the
  environments folio runs in: WebKitGTK (Linux desktop shell) has no system
  dictionary integration, and native suggestions are unreachable inside
  table-cell content and custom context menus.
- folio must render and proof fully offline (ADR-0005): the checker ships
  with the app, no network at check time.
- Deterministic, testable in headless CI (jsdom / Playwright): native
  spellcheck is not.

## Spell check (default ON)

- Engine: **nspell** (MIT) with the vendored Hunspell `en_US` dictionary
  (`src/assets/dict/`, license in `LICENSE.en_US.txt`). Loaded lazily from
  bundled assets on first use; no runtime network.
- The host sets `spellcheck="false"` on the rendered article so the browser
  never draws its own squiggles; the bundled checker owns all marks.
- Component attribute `spellcheck` (default true) toggles it:
  `<folio-doc spellcheck="false">` disables checking. Toggling is available
  from the command palette ("Turn spell check off/on").
- Marks: misspelled words are wrapped in `<span class="folio-misspelled">`
  (wavy underline in `--folio-error`). Wraps are re-applied after every
  render and debounced (300 ms) after input. They are pure view-layer spans:
  `htmlToInlineMarkdown` unwraps unknown spans, so the Markdown model never
  contains them, and they are suppressed in `@media print`.
- Scope: prose blocks (`p`, headings, list items) and table data cells
  (`td`) — every editable text surface. Inspector chrome, code, menus and
  the header rename control (`th .name`) are excluded: a mark pass
  rewrapping inside the rename target would blur it and drop the
  header's "editing" state (right-click in a header still offers
  suggestions via hit-testing, just without a squiggle).
- Caret-safe: marks are applied with the caret saved/restored per block
  (text node + offset), so typing is not disturbed.
- Passes are serialized: a mark pass is async (it awaits the dictionary /
  the grammar engine), and a pass requested while one is in flight runs
  only after it finishes — concurrent passes would interleave the
  unwrap/rewrap and nest the mark spans.
- Context menu: right-click a misspelled word in prose → suggestions
  (top 8 from nspell) that replace the word in place and re-sync the
  model, plus "Add to dictionary". In a table cell the right-click
  keeps opening the table menu (cells are the table's context); the
  spelling suggestions and "Add to dictionary" are prepended as the
  menu's top group, word-processor style.
- Custom words persist in `localStorage` under `folio.spellcheck.custom.v1`.

## Grammar check (opt-in, OFF by default)

- Engine: **harper.js** (Apache-2.0), lazy-loaded as a separate chunk on
  first use — the ~20 MB slim wasm downloads once (from the app's own
  assets, still offline after first load) and is cached. Eager bundling
  stays possible later if it proves valuable; the lazy chunk is deliberate.
- English-only in this pass. Consent = running the palette command
  "Check grammar with Harper…" (the command title states the one-time
  download). State persists in `localStorage` under `folio.grammar.v1`;
  the component exposes `grammarOn` / `setGrammar(on)`.
- Marks: grammar hits are wrapped in `<span class="folio-grammar">` (wavy
  underline in `--folio-accent`), same view-layer rules as spell marks.
- Context menu: right-click a grammar mark → its suggestions; clicking one
  replaces the span text and re-syncs.

## Markdown source view

- The source view is a transparent textarea over a syntax-highlight
  overlay (`#md-view`, built from `highlightMarkdown` tokens), so the
  bundled checkers mark it too: misspelled words (and grammar hits, when
  enabled) are wrapped in the same mark spans inside the overlay. The
  textarea's value never contains marks; its native `spellcheck` stays
  `false` so squiggles never double up.
- Only prose tokens are checked (`text`, headings, bold/italic/strike/
  underline). Code spans, fenced code, math, the YAML frontmatter block,
  and `::: ` directive lines (table/chart/mermaid bodies) are markup, not
  prose, and are never marked.
- Oversized text is never checked: words longer than 64 chars and prose
  tokens longer than 4096 chars are not words/prose (a pasted image's
  `data:` URL is one multi-megabyte line). Spell-marking it pegged the
  engine for minutes - hunspell on a megabyte "word" allocates until the
  tab dies, and high-entropy base64 splits into >100k "words".
- Marks are re-applied (debounced 300 ms) after every source render, and
  passes are serialized like in the document view. The `spellcheck`
  attribute governs both views; the grammar toggle governs both too.
- Right-clicking a marked word in the source view opens the same
  suggestion menu as the document view (the textarea has no native spell
  menu); picking a suggestion rewrites the source in place, and the
  change lands in the model when the view switches back.

## Out of scope

- Tauri per-engine native spellcheck as the primary mechanism. If a future
  Tauri build wants native marks, they must not double with bundled marks;
  the article stays `spellcheck="false"` either way.
- Multi-language dictionaries, grammar in other languages, real-time
  grammar while typing (grammar lints on render/debounce like spell, but
  is opt-in).

## Acceptance

- Misspellings show squiggles in prose and table cells; right-click offers
  working suggestions and add-to-dictionary; palette toggles checking;
  `spellcheck="false"` clears marks; marks never enter `getDoc()` Markdown
  and never print.
- Grammar is off until the palette command runs; then grammar marks appear
  with working suggestions; state persists across reloads.
- Works with JavaScript-only environments (no network at check time after
  first grammar load).
