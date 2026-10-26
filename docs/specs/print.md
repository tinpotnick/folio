# Print / PDF

## Status: accepted (2026-10-18)

## Decision

One pipeline for both "Print" and "Save to PDF": the OS print
dialog (every platform's dialog exports PDF), driven by a print
stylesheet that shows the rendered document, not the app chrome.
No separate PDF export engine, no new dependency (ADR-0007).

## Contract

- **Triggers**: the palette command "Print the document"
  (`window.print()`), Ctrl+P, or the browser's own menu - all land
  in the same place. folio binds Ctrl+P itself (calling
  `window.print()`): the desktop app's webview (WebKitGTK) has no
  browser binding for it, so it did nothing there.
- **beforeprint normalization** (host): whatever the trigger, open
  dialogs (help, palette, settings) close and the Markdown source
  view switches to the rendered document view first. The user
  prints the document, never the source.
- **Print stylesheet (host)**: `@page { size: A4; margin: 18mm
  16mm }`; header, sidebar, status bar, and the Markdown editor
  are `display: none`; the layout collapses; the page itself
  carries the margins.
- **Print stylesheet (component/theme)**: the article goes full
  width; headings avoid being separated from what follows
  (`break-after: avoid`); figures, tables, and code blocks avoid
  splitting (`break-inside: avoid`); exact color reproduction for
  code/table backgrounds. Charts and diagrams are SVG and print
  vector-crisp.
- **Page breaks** (see document-settings.md): `pagebreak.h1` /
  `pagebreak.h2` emit `break-before: page` under `@media print`
  only (screen computed styles stay `auto`), guarded by
  `:not(:first-child)` so the first heading never opens a blank
  page.

## Acceptance

- e2e: `tests/e2e/print.spec.ts` (print media hides chrome,
  beforeprint switches views and closes dialogs, palette command
  calls print, page-break style applies in print media only).
- First-contact eval: `evals/print-first-contact.md`.

## Export as PDF (2026-10-22)

- **Where**: the File group's **Export ▾** menu ("Export as" → PDF
  document), and the palette's "Export as PDF" (keywords: export,
  pdf, save as pdf, download, share). The menu leaves room for more
  formats later.
- **Before**: the same normalization as printing (`preparePrint`:
  dialogs close, Markdown view switches to the document), then it
  waits until no figure still says "Drawing…" / "Building the
  model…" (up to 15 s).
- **Desktop (Linux)**: `export_pdf(suggested, furniture)` (ADR-0025) - a save
  dialog filtered to .pdf, named after the open file or the title,
  starting in the last used folder; then a WebKitGTK print operation
  writes the print stylesheet straight to that file ("Print to
  File", A4, 18 x 16 mm margins as `@page` says) with no print
  dialog. The flash reports the path; a failure is a flash, never
  silent. Other platforms report "unsupported" and fall back to the
  web behaviour.
- **Web**: a browser cannot write a PDF itself; Export flashes
  'Choose "Save as PDF" as the destination' and opens the print
  dialog.

## Page numbers and running header (2026-10-26, ADR-0027)

- **What**: "Page n of N" bottom right on every page, and from page 2
  the document's title (its first H1, Markdown marks removed) top
  left - small grey sans-serif, in the page margin. Page 1 carries the
  title itself, so it has no header.
- **Settings**: style keys `page.numbers` and `page.header`, on when
  unset, `"off"` to remove (document-settings.md; the dialog writes
  it quoted, since YAML 1.1 reads a bare `off` as false - both
  spellings are read the same). No title, no header.
- **Print / web**: `preparePrint` writes the furniture into the host's
  `<style id="print-furniture">` as `@page` margin boxes
  (`furnitureCss`, `src/render/page-furniture.ts`) - they only apply
  from the document's own stylesheet, not a shadow root. Browsers
  without margin boxes (WebKit-based) print without them.
- **Desktop export**: `export_pdf(suggested, furniture)`; after
  WebKitGTK writes the PDF (which ignores margin boxes), Rust stamps
  the same text in the same places (`pdf_furniture::stamp`, lopdf):
  Helvetica 8.5 pt, grey, header at 16 mm / 11 mm from the top-left,
  numbers right-aligned 16 mm from the right, 9 mm from the bottom. A
  title with characters outside WinAnsi is left off rather than
  printed as "?".
- **Desktop Print** goes through WebKitGTK's own print dialog, whose
  output folio never sees: no page numbers or header. Print says so
  (flash: "For page numbers, use Export as PDF") and the help points
  to Export. Considered and deferred (2026-10-26): Print builds the
  stamped PDF and hands it to `GtkPrintUnixDialog` +
  `gtk_print_job_set_source_file` (libgtk-3, already linked); macOS
  would use PDFKit's `PDFDocument.printOperation`; Windows' WebView2
  (Chromium) likely prints margin boxes already - unverified.
- **Light paper**: before printing or exporting, every `<folio-doc>`
  switches to the light rendition (charts and diagrams redraw; export
  waits for them via `drawn()`), and goes back to the app's mode on
  `afterprint` / when the export finishes.
- Acceptance: `tests/render/page-furniture.test.ts`, the Rust tests in
  `pdf_furniture.rs` (stamped pages, unspellable title),
  `tests/e2e/print.spec.ts` (furniture CSS, light mode while printing,
  settings write the keys), eval `evals/page-numbers-first-contact.md`.

