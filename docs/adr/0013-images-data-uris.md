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
  in place; alt/caption/file replacement live in the image
  inspector (uniform bar contract); Backspace on a selected
  image removes the block (the diagram affordance).
