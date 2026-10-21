# ADR-0017: Bundled open-licence typefaces for themes

Date: 2026-10-21

Status: accepted

## Context

Themes (ADR-0002, docs/specs/themes.md) named typefaces such as
"Source Serif 4", Merriweather and Georgia, but folio shipped none
of them. On a machine without them, which includes most Linux
desktops and therefore the Tauri desktop host, every one of those
names fell back to the same system serif. Themes that differed
mostly by font looked identical, and the document's "look" depended
on whatever the reader had installed. That breaks the promise that
a document renders the same everywhere, offline (ADR-0005).

## Decision

Bundle ten variable typefaces with the component, from the
**Fontsource** packages (`@fontsource-variable/*`):

| Family | Role |
|---|---|
| Source Serif 4 | the default text and display serif |
| Inter | neutral sans (corporate, modern, elegant, swiss) |
| IBM Plex Sans | technical sans |
| Fraunces | editorial display serif |
| EB Garamond | book serif (manuscript) |
| Space Grotesk | modern display sans |
| Libre Franklin | news display sans |
| Playfair Display | high-contrast display serif (elegant) |
| Literata | long-form reading serif (editorial) |
| JetBrains Mono | code |

- **Licence:** every typeface is SIL Open Font License 1.1, which
  allows bundling and redistribution with software. The npm
  packages' own code is MIT. No AGPL or commercial terms.
- **Maintenance:** Fontsource is the standard npm distribution of
  open fonts. It is actively maintained, versioned, and has no
  runtime code; we import only `.woff2` files.
- **Size:** Latin subset, one variable-weight file per style
  (normal, plus italic for the text faces): about 820 KB across
  19 files. A browser downloads a face ONLY when a rendered
  document uses it, so a document in the default theme loads
  about 100 KB.
- **Offline (ADR-0005):** the files are emitted as hashed assets
  next to the bundle (`?url` imports in `src/render/fonts.ts`) and
  load from the app's own origin. Nothing is fetched from a font
  CDN.
- **Registration:** `@font-face` rules do not apply inside a shadow
  root, so the component registers the faces once on its host
  document (`registerFonts`). This also lets the host show them,
  for example in the settings dialog's theme cards.
- **Scope:** themes may name only bundled faces; a unit test pins
  this. A document's own `body.font.family` may still name any
  font. It falls back to a serif when the reader lacks it, which is
  the author's explicit choice.

## Why existing dependencies don't cover it

Nothing in the tree ships typefaces. System font stacks cannot
guarantee a particular look, and that guarantee is the point of
a theme.

## Consequences

- Themes look the same on every OS and in print or PDF.
- Non-Latin scripts (Arabic, Hebrew, CJK) still render from system
  fonts through the unicode-range fallback; a theme does not
  restyle them.
- Adding a face is a deliberate act: an import in `fonts.ts`, an
  entry in `BUNDLED_FONTS`, and a row in this ADR.
