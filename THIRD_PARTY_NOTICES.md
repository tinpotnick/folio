# Third-party notices

folio is MIT-licensed (see `LICENSE`). Its builds include the
following third-party components under their own licences, all of
which permit redistribution in an MIT-licensed application.

| What | Licence | Notes |
| --- | --- | --- |
| npm runtime packages (Mermaid, Vega/Vega-Lite, KaTeX, highlight.js, JSCAD, abcjs, jexl, Viz.js, ...) and their dependencies | MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, Unlicense | Each package's licence travels with it in its own files. |
| DOMPurify | MPL-2.0 OR Apache-2.0 | Used under Apache-2.0. |
| elkjs (Mermaid layout) | EPL-2.0 | Unmodified; source at https://github.com/kieler/elkjs |
| Graphviz, compiled to WebAssembly in Viz.js | EPL-1.0 (Graphviz), MIT (Viz.js) | Unmodified; source at https://gitlab.com/graphviz/graphviz |
| Fonts: EB Garamond, Fraunces, IBM Plex Sans, Inter, JetBrains Mono, Libre Franklin, Literata, Playfair Display, Source Serif 4, Space Grotesk | SIL Open Font License 1.1 | Bundled via Fontsource; licence files in each font package. |
| Drum kit samples (`src/audio/drums/`) | CC0 1.0 | From Sonic Pi's sample set; provenance in that folder's README. |
| Desktop app: Tauri and its Rust crates | MIT and/or Apache-2.0 (a few MPL-2.0, Unicode-3.0) | Listed in `apps/desktop/src-tauri/Cargo.lock`. |

## Not included: the Strudel player

Strudel (https://strudel.cc) is AGPL-3.0-or-later. folio's builds do
**not** contain it. When a user first plays a Strudel block, folio
asks, then downloads the unmodified, hash-pinned `@strudel/web`
release from jsDelivr and keeps it on that machine (ADR-0026). Its
source is at https://codeberg.org/uzu/strudel.
