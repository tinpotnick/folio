# Code blocks (fenced)

## Status: accepted (2026-10-18)

## Decision

Fenced code blocks are a first-class block kind, per GitHub Flavored
Markdown: ``` with an optional language tag. Previously the toolbar
"code" button produced a bare `<pre>` in the DOM that the model
flattened back to prose - nothing durable happened.

## Contract

- **Model**: `{ kind: "code", lang?: string, text: string }` in
  `src/engine/doc.ts`. The parser collects fenced regions
  (3+ backticks + optional language) and errors on unterminated
  fences; the serializer emits ``` + lang fences. Round-trip
  identity holds (golden tests unaffected - the sample has no
  fences).
- **Render**: `figure.folio-codeblock[data-lang]` holding the code
  header (below) and the body `pre.folio-code > code` (themed:
  mono with ligatures off so `->` shows as typed, tinted background,
  pre-wrap). Unlike the generated figures
  the figure is NOT contenteditable=false: the body edits in place,
  exactly like the bare `pre` it replaced. The source-view
  highlighter emits `fence` tokens for delimiter lines and `code`
  tokens for content.
- **Code header** (one header for every language): an inspector bar
  (`.code-inspector`) following the ONE inspector contract
  (docs/specs/figure-inspectors.md) - reveal on a click inside the
  block, hide on any click outside, Esc dismisses early, no close
  button. It holds the **language picker** (`select.code-lang`):
  Plain text (a bare fence) plus the supported languages
  (`CODE_LANGUAGES` in `src/render/code.ts`); a fence tag outside
  that list stays selectable as itself, so opening the header never
  rewrites an unknown tag. Picking a language is a model write: the
  fence tag changes, the one figure re-renders in place, and the
  header stays open. Languages add their own controls after the
  picker - Strudel adds its player (docs/specs/strudel-blocks.md).
  The header is `position: sticky` (top: `--folio-sticky-top`,
  which a host with sticky chrome sets - the demo host sets its
  52px app header) so a long block's controls stay in view.
- **Syntax highlighting** (ADR-0015): supported languages are
  colored with highlight.js - core and grammars bundled and lazily
  imported on first use, never fetched. Fence tags and common
  aliases (`js`, `ts`, `py`, `sh`, `yml`, `toml`, ...) map to a
  grammar; `strudel` colors as JavaScript; plain and unknown tags
  stay uncolored. Highlighting is presentation only: token spans
  over the text, the model reads `innerText` back, round-trip
  identity holds. Colors live in the theme CSS (highlight.js token
  classes), never in the document. Repainting would move the caret,
  so it runs on render and when the user leaves the block (its
  header hides); text typed meanwhile takes the color of the span
  it lands in until then.
- **Removal**: Backspace in an EMPTY code body removes the block
  (the caret moves to the end of the previous block); the toolbar's
  code button still converts the block back to prose.
- **Palette**: "Change the code block language" reveals the caret
  block's header with the picker focused (a flash explains when the
  caret is not in a code block).
- **Editing**: code blocks sync from the DOM as plain text via
  `innerText` (rendered line breaks become model newlines). Enter
  inside a code block inserts a line break instead of splitting the
  block.
- **Structural sync**: `syncFromDom` REBUILDS the block list from
  the article's children on every input - the DOM is the source of
  truth during typing (the component's founding design). Text blocks
  (prose, headings, code) are re-derived wholesale; generated blocks
  (tables, charts, diagrams) are preserved by figure identity in
  document order. This is what makes native structural edits work:
  Enter in prose/headings runs natively (the engine splits the block
  and places the caret on the new line - word-processor behavior in
  every engine, including WebKitGTK), Backspace at block boundaries
  merges, and the model follows. The old model-split + re-render
  path destroyed the caret, which forced a click before typing.
  Enter inside a selected diagram is prevented (diagrams never
  split). After each rebuild the article's children are re-stamped
  with their positional `data-block-index` (guarded to when the
  child count matches the rebuilt model): native splits create
  elements that carry no index, and without the re-stamp every
  index-based action on them (block conversion, code toggling,
  caret tracking) silently no-opped.
- **Toolbar**: the code-block button lives in the insert group
  (table / diagram / code) with a `</>` icon. In document view it
  toggles the caret's block between prose and a code block
  (model-level; the caret is restored to the block after the
  re-render) and reflects the caret's block. In Markdown view it
  fences the caret's whole paragraph (blank-line delimited). The
  inline format bar keeps only inline formats; inline code is typed
  as backticks in the source.
- **Caret offsets**: `caretOffsetIn` reads the caret from the
  shadow root's selection - the document-level selection is
  retargeted to the light DOM, which made Enter mis-split blocks
  (it split even at the end of a paragraph). Where no selection is
  pierceable (WebKitGTK) it assumes the end of the block so Enter
  appends instead of splitting wrongly.
- **Caret resolution**: the block at the caret resolves from the
  event target, the shadow selection, or the last clicked block
  (shadow-root hit testing) - the same engine-aware chain as the
  other caret-dependent features.

## Acceptance

- `just lint`, `just test`, `just build` green; engine round-trip
  tests for fences (with/without language, unterminated error);
  e2e: fence round-trip, toolbar conversion both directions, Enter
  inserts a newline.
- e2e (`tests/e2e/code-blocks.spec.ts`): the header reveals/hides
  per the inspector contract and shows the fence's language;
  supported languages carry token spans while the text is
  unchanged; plain/unknown tags stay uncolored and unknown tags
  stay selectable; picking a language rewrites the fence tag
  (Plain text drops it, Strudel adds the player); edits recolor
  when the caret leaves; the sticky header stays in view inside a
  long block; the palette command focuses the picker.
- First-contact eval: `evals/code-blocks-first-contact.md`.

## Fence info (2026-10-21)

A fence's info string may carry more than the language (GitHub's
```` ```js title="x" ````, folio's ```` ```jscad params=@t row=2 ````).
The rest is kept verbatim as `info` and round-trips byte for byte.
Two bugs fixed with it: such a fence hung the parser (the paragraph
collector stopped at the ```` ``` ```` line without consuming it), and
the DOM-to-model sync rebuilt code blocks from language and text only,
so typing anywhere dropped every info string. The figure now carries
it as `data-info`.

## Code body integrity (2026-10-21)

A code body is plain text: `<pre><code>text</code></pre>`, with only
the highlighter's spans inside. Native editing breaks that in two
ways. Typing into an EMPTY block lands in the `<pre>` beside the empty
`<code>`, and that text was silently lost from the source.
Select-all + retype leaves the engine's `<font>`/`style` markup (inline
styling, breaking non-negotiable #1). On every edit, the structural
sync rebuilds such a body as plain text, caret at the same text
position (`normalizeCodeBody`). Ctrl/Cmd+A inside a code body selects
the CODE, never the whole document. e2e: `tests/e2e/code-blocks.spec.ts`
"code body integrity".

