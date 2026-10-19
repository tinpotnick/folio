# Images

## Status: accepted (2026-10-18, ADR-0013)

## Decision

Images are semantic figure blocks. A folio document is one file
(ADR-0005), so images EMBED as data URIs in an image directive -
the canonical form the insert button writes and the serializer
emits:

```
::: image {#ops-cover}
src: data:image/svg+xml;base64,...
alt: "The ops team, Q3 all-hands"
caption: "Q3 all-hands"
:::
```

## Contract

- **Two syntaxes, one model**: the parser also accepts a
  standard `![alt](src)` line as its own block; it canonicalizes
  to the directive on the next save, with ids assigned per
  document (`image-1`, `image-2`, ...). An image inline in a
  prose line stays prose.
- **Keys**: `src` (required, raw/unquoted - data URIs and URLs
  carry no spaces), `alt` (quoted, optional), `caption` (quoted,
  optional). Unknown keys are a parse error, like tables.
- **Offline**: data URIs are the recommended form - the image is
  the document. External URLs/paths render opportunistically
  (alt text when unreachable); they are never a render
  dependency.
- **Insert**: the insert group's image button opens the host
  file picker (`<input type="file">` - one code path for web and
  every Tauri webview), reads the file as a data URI, and seeds
  `alt` from the file name. Files over 8 MB are refused with a
  visible message. The palette command "Insert an image" works
  without prior document focus (appends at the document end).
- **Figure, not an editing surface**: `figure.folio-image`
  (contenteditable=false) renders the img and an optional
  figcaption. Clicking the image reveals the image inspector -
  alt text, caption, and a replace-file control - on the uniform
  bar contract (reveal inside the figure, hide on any outside
  click, Esc dismisses, no close button). Backspace/Delete on a
  selected image removes the block (the diagram affordance).
- **No float/wrap/resize** (ADR-0013 non-goals): layout is the
  renderer's. A semantic `width` key is a possible later
  addition; anchoring and text wrap are not.

## Acceptance

- Engine: `tests/engine/doc.test.ts` ("image blocks" describe:
  directive round-trip, `![]()` canonicalization, inline stays
  prose, per-document ids, missing src and unknown key errors);
  the sample document's image rides the golden byte-identity
  test.
- e2e: `tests/e2e/images.spec.ts` (8 tests: sample figure,
  insert button reaches the source, hand-typed form renders and
  canonicalizes, inspector alt/caption/replace, Backspace
  removal, uniform dismissal, oversized refusal).
- First-contact eval: `evals/images-first-contact.md`.
- Documented in `demo/help.md`; ADR-0013 records the storage
  decision.
