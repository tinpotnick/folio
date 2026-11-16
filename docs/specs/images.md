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
- **Downscaling on embed** (paste, picker, inspector replace): the
  document is one file, so a photo is shrunk on the way in - like
  Word. Files over 400 KB are re-encoded: longest edge capped at
  2048 px, JPEG (quality ladder 0.85/0.7/0.55 down to the 400 KB
  target) unless the image has transparency, which stays PNG. The
  file is never grown: if re-encoding doesn't win, or the bytes
  don't decode, the original is embedded as-is (and still subject
  to the 8 MB ceiling). Rationale: a raw multi-MB base64 is one huge
  line in the Markdown source view, and laying it out made switching
  to that view take many seconds. The status bar says when a picture
  was resized ("resized to fit"). **Opt-out**: the image is the
  document, so downscaling must never be silent-only - the persisted
  setting `folio.images.keep-originals.v1`, toggled by the palette
  command "Keep original image quality", disables it entirely; the
  8 MB ceiling applies either way.
- **Paste**: a clipboard image with no plain-text flavor embeds as
  an image block at the caret. A file on the clipboard (screenshot,
  copied picture) becomes a data URI (downscaled as above), `alt`
  seeded from the file name, over 8 MB refused with a status
  message. An image copied from a web page (no file data -
  `text/html` with an `<img>`, or a uri-list) embeds with that
  `src`: data URIs directly, remote URLs opportunistically with
  the alt as fallback. Text paste stays plain text only; a
  clipboard carrying both takes the text.
- **Figure, not an editing surface**: `figure.folio-image`
  (contenteditable=false) renders the img and an optional
  figcaption. Clicking the image reveals the image inspector -
  alt text, caption, and a replace-file control - on the uniform
  bar contract (reveal inside the figure, hide on any outside
  click, Esc dismisses, no close button). Backspace/Delete on a
  selected image removes the block (the diagram affordance).
- **A trailing figure never traps the caret**: when a non-editable
  figure (image/audio/chart/diagram/math/motion) is the LAST block,
  there is no caret target below it - so ArrowDown from the end of
  the block above, ArrowDown on the selected figure, and clicking
  the empty space below the figure each append a new empty
  paragraph after it and focus it. No trip to the Markdown source
  needed to add content below a trailing image.
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
- Documented in `demo/help/images-audio.md`; ADR-0013 records the storage
  decision.
