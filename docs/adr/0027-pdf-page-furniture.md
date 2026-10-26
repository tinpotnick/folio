# ADR-0027: Page numbers and running headers on paper (lopdf)

Date: 2026-10-26

Status: accepted

## Context

A report needs page numbers, and from page 2 a running header with
its title. CSS has the tool for this - `@page` margin boxes
(`@top-left`, `@bottom-right` with `counter(page)` and
`counter(pages)`) - and Chromium-based browsers print them. WebKit
does not: WebKitGTK's print engine, which writes the desktop app's
PDF export (ADR-0025), ignores margin boxes entirely (tested
2026-10-26: the same stylesheet gives "Page 1 of 6" from Chromium and
nothing from WebKitGTK). Running JavaScript cannot help either: the
page count and the page breaks are only known inside the print
engine.

## Decision

- The furniture is a document style, like page breaks: style keys
  `page.numbers` and `page.header`, on by default, `off` to remove,
  set in Document settings. Nothing goes into the text (AGENTS.md #1).
- **Browsers**: the host writes the margin boxes into its own
  stylesheet before printing (`src/render/page-furniture.ts`; margin
  boxes do not apply from a shadow root).
- **Desktop export**: after WebKitGTK writes the PDF, Rust stamps the
  same furniture onto each page (`src-tauri/src/pdf_furniture.rs`):
  the page's existing content is wrapped in `q … Q`, then a small text
  stream in Helvetica (a standard PDF font, so nothing is embedded)
  draws the header and "Page n of N" in the same places and grey as
  the margin boxes.
- New dependency: **lopdf** 0.46 (MIT; actively maintained, pure Rust,
  the usual crate for editing existing PDFs), with default features off
  (no image decoding, no rayon). Nothing already in the tree reads or
  writes PDF objects; writing a PDF parser by hand for this would be a
  worse version of the same crate.

## Consequences

- Export and a Chromium print give the same pages. A browser without
  margin boxes (WebKit-based ones, such as Safari) prints without
  them - the browser's limit, noted in the help; Export in the
  desktop app always has them.
- The stamped text is WinAnsi (Latin-1 plus typographic punctuation);
  a title in another script is left out of the exported header rather
  than printed as "???". Embedding a font subset would fix that and is
  the next step if it matters.
- macOS / Windows export (not built yet) can reuse the stamping.
