# ADR-0013: Images embed as data URIs

Date: 2026-10-18
Status: accepted

## Context

A document-first workspace needs images: covers, screenshots,
photos, diagrams exported from other tools. The hard constraint
is ADR-0005 - a folio document is ONE file that renders fully
offline. The alternatives:

1. **Reference local files** (`![alt](./img/photo.png)`) - the
   document stops being one file; copy the .md without the
   assets and it breaks. A render dependency outside the doc.
2. **Reference remote URLs** - worse: the render depends on the
   network, and links rot.
3. **Embed as data URIs** - the image IS the document. Larger
   Markdown source, but every invariant holds: offline, one file,
   byte-identical round-trip, no dependency graph.

## Decision

Images embed as data URIs in an image directive (markdown+):

```
::: image {#ops-cover}
src: data:image/svg+xml;base64,...
alt: "The ops team, Q3 all-hands"
caption: "Q3 all-hands"
:::
```

- The directive is the CANONICAL form - what the insert button
  writes and what serializeDoc emits. The parser also accepts a
  standard `![alt](src)` line on its own; it canonicalizes to the
  directive on the next save (ids assigned per document). Users
  can hand-type the standard form; folio keeps one model.
- External URLs/paths in `src` are passed through and rendered
  opportunistically - the browser shows them when reachable, alt
  text when not. They are never a render dependency: the document
  (structure, text, tables, charts) always renders.
- No new dependency (ADR-0007): the browser's own img element
  decodes. File picking uses the host's `<input type="file">` -
  works in every Tauri webview (WebKitGTK, WebView2, WKWebView)
  and on the web with one code path; no Rust command needed.
- Ceiling: the host refuses files over 8 MB with a visible
  message. A folio document is one file; a 40 MB screenshot
  makes the Markdown source unusable. Resize before embedding is
  the user's job (for now).

## Non-goals

- **Floating/anchored images, text wrap**: declined. Layout is
  the renderer's job (invariant #2 - style lives in themes, and a
  floating anchor is layout semantics the theme schema would have
  to own). A width/scale inspector field may come later as a
  semantic `width` key; float/wrap is not on the table.
- **An asset store** (images as sidecar files with a manifest):
  rejected for now - it breaks one-file portability, the very
  thing that makes folio documents trivially shareable.

## Consequences

- Markdown sources with images are long; the source view shows
  real base64 (honesty over prettiness - the invariant is
  byte-identity, and eliding would break round-trip trust).
- Large documents with many photos will eventually want the
  section-windowing work (docs/specs/section-windowing.md);
  images raise the stakes for lazy figures, not the design.
- The image is generated output like every figure: not editable
  in place; alt/caption/file replacement, download-and-embed, and
  the crop/zoom tool live in the image inspector (uniform bar
  contract); Backspace on a selected
  image removes the block (the diagram affordance).

## Amendment 2026-11-16: basic images stay standard Markdown

Status: accepted (amends the Decision above)

The directive was made canonical so hand-typed `![alt](src)` lines
would normalize to one model. That throws away the standard form's
main advantage - a folio file with a basic image is also a plain,
portable Markdown file (GitHub et al. render it). So, mirroring the
simple-table rule (a pipe table stays a pipe table until typed
features are needed):

- A **basic** image - src + alt only, data URI or URL - is stored
  and serialized as the standard `![alt](src)` on its own line. No
  id. Insert/paste write this form.
- The **directive** form appears only when the block needs more than
  src+alt: a `caption:` (or an anchor id). Adding a caption in the
  inspector upgrades the block (assigns `image-N`) - one-way, like a
  simple table becoming a dataset. A parsed directive keeps its form,
  so existing documents round-trip byte-identically.
- An image inline inside a prose line stays prose (standard
  Markdown semantics).
- **External images are never downloaded automatically.** An
  `http(s)://` src renders opportunistically (alt when unreachable),
  never a render dependency. Inlining happens only via the explicit
  "Download and embed" action (inspector button / palette command),
  which fetches once, on that click - the ADR-0019 consent pattern -
  then applies the embed ceiling and downscaling.
