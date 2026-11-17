# Images

## Status: accepted (2026-10-18, ADR-0013)

## Decision

Images are semantic figure blocks. A folio document is one file
(ADR-0005), so images EMBED as data URIs - but a BASIC image (src +
alt only) stays standard Markdown `![alt](src)` on its own line
(amendment to ADR-0013, 2026-11-16): the file remains portable plain
Markdown. The directive form is used only when the block needs more
than src+alt:

```
::: image {#ops-cover}
src: data:image/svg+xml;base64,...
alt: "The ops team, Q3 all-hands"
caption: "Q3 all-hands"
:::
```

## Contract

- **Two syntaxes, one model**: a standard `![alt](src)` line as its
  own block IS a basic image block - it round-trips unchanged (no
  id, no canonicalization). The directive appears only once the
  block needs a `caption:` or an anchor id: adding a caption in the
  inspector upgrades the block (assigns `image-N`), one-way like a
  simple table becoming a dataset. A parsed directive keeps its
  form, so existing documents round-trip byte-identically. An image
  inline in a prose line stays prose.
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
- **External images are never downloaded automatically** (ADR-0019
  consent pattern): an `http(s)://` src renders opportunistically,
  never a render dependency. Inlining happens only via the explicit
  **"Download and embed"** action (image inspector button, or the
  palette command) - one fetch on that click, then the embed
  ceiling (8 MB) and downscaling rules apply; failures leave the
  src untouched with a status message.
- **Figure, not an editing surface**: `figure.folio-image`
  (contenteditable=false) renders the img and an optional
  figcaption. Clicking the image reveals the image inspector -
  alt text, caption, replace-file, download-and-embed (external
  srcs), and a crop tool - on the uniform bar contract (reveal
  inside the figure, hide on any outside click, Esc dismisses, no
  close button). Backspace/Delete on a selected image removes the
  block (the diagram affordance).
- **Crop / zoom tool** (inspector "Crop / zoom" button, or the
  palette command "Crop / zoom image"): drag on the image to select
  a region, zoom slider (1-4x) to place it precisely, Apply
  re-encodes the region via canvas as the new src (PNG when it has
  alpha, else JPEG quality ladder; 8 MB ceiling applies). The
  selection is stored as fractions of the natural image, so zooming
  never corrupts it. Cancel restores the original view untouched.
- **A trailing figure never traps the caret**: when a non-editable
  figure (image/audio/chart/diagram/math/motion) is the LAST block,
  there is no caret target below it - so ArrowDown from the end of
  the block above, ArrowDown on the selected figure, and clicking
  the empty space below the figure each append a new empty
  paragraph after it and focus it. No trip to the Markdown source
  needed to add content below a trailing image.
- **No per-image float/wrap/resize in the document** (ADR-0013
  non-goals stand): nothing layout-related is stored per image.
  Document-WIDE image layout is theme-owned instead, via the
  `figure.image.layout` / `.align` / `.width` style keys
  (docs/specs/themes.md) - `float-left`/`float-right` wraps text
  around every image figure, consistently, for both the standard
  `![alt](src)` form and the `::: image` directive.

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
