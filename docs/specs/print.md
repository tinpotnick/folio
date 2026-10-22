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
- **Desktop (Linux)**: `export_pdf(suggested)` (ADR-0025) - a save
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
