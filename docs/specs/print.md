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
  vector-crisp. Screen-only controls never print: inspector bars, a drawn
  figure's source, and a long table's "Open dataset" button (its
  "201 rows x 12 columns - showing first 12" line stays, so the
  reader knows the table is cut short).
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
  spellings are read the same). No title, no header. `page.header`
  also takes custom text, and `page.footer` adds a bottom-left footer;
  both can change mid-document via `::: page` blocks (below).
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

## Page sections: changing the header/footer mid-document (proposed 2026-11-23)

- **What**: a `::: page {#sec-2}` block in the body (block-schema.md)
  starts a new print SECTION: a new printed page, and from that point
  until the next `::: page` block the page furniture is the block's
  `header:` / `footer:` / `numbers:` values and its page geometry is
  the block's `size:` / `orientation:` values. Omitted keys carry
  forward - the previous section's values; before any block, the style
  defaults (`page.header` = title / custom text / off, `page.footer`
  = off or text, `page.numbers` = on unless off, `page.size` = theme
  default, `page.orientation` = portrait). So every occurrence
  updates exactly what it names, from that point onwards.
- **Orientation**: `page.orientation` = `portrait` (default) |
  `landscape`, at doc level (a style key next to `page.size`,
  document-settings.md) and per section (`orientation:` on the block,
  carrying forward like the furniture keys). CSS: each named
  `@page folio-sec-N` carries the section's effective
  `size: <page-size> <orientation>` (every named rule repeats it -
  a named page replaces the base `@page` for its pages, so the
  inherited value must be restated). For the deck sizes `16:9` /
  `4:3` the dimensions are already landscape; `portrait` there swaps
  them. Orientation and size are print-only; the slideshow's screen
  aspect is unchanged. On desktop export each section's print run
  sets its own paper size and orientation in the page setup before
  stamping and merging.
- **Slots are independent**: header top left, footer bottom left,
  "Page n of N" bottom right - all three may appear on one page.
  `numbers: off` in a block suppresses numbering from that section on
  (until a later block says `numbers: on`). The document's very first
  page still shows no running header (it carries the title); the
  first page of a LATER section does show its section's header.
- **Page numbers never restart**: the counter is absolute across the
  document - Chromium's `counter(page)` is global across named pages;
  the desktop export offsets each section's pages by the page counts
  of the sections before it. A break after page 3 still reads
  "Page 4 of 12".
- **Why a forced page break**: WebKitGTK's print operation never
  reveals which printed page an element lands on, so a mid-page
  furniture change cannot be stamped exactly on desktop. Each
  section starting on a new page makes every page belong to exactly
  one section, so furniture is exact on both engines - Word's
  "section break, next page" semantics.
- **Screen**: the block renders as an invisible placeholder - page
  furniture is page-only, never screen content (the same rule as
  `pagebreak.h1`: a page break is a style, not content, AGENTS.md #1).
  It is read and edited in the Markdown view and inserted from the
  palette ("Insert page section"); palette + in-app-help + eval ship
  in the same commit as the feature (ADR-0009).
- **Chromium (web print, Chromium desktop)**: at beforeprint the
  component tags each block element with its section class
  (`folio-sec-N`, computed from the model), and the host's print
  stylesheet (`#print-furniture`) gains one named page per section:
  `@page folio-sec-N { size: <effective size + orientation>;
@top-left { content: "..." } @bottom-left {
content: "..." } @bottom-right { content: "Page " counter(page)
" of " counter(pages) } }` - omitting the boxes a section leaves
  unset, but always restating the carried-forward `size:` (a named
  page replaces the base `@page` for its pages). The existing
  `@page :first { @top-left { content: none } }`
  guard still hides the header on the document's first page only.
  The `page:` property itself is set under `@media print` from the
  shadow stylesheet (`.folio-sec-N { page: folio-sec-N }`); the
  `@page` rules must live in the host stylesheet because margin boxes
  do not apply from inside a shadow root - the same reason the
  existing furniture is injected there.
- **Desktop export (WebKitGTK, extends ADR-0027)**: the document is
  printed once PER SECTION (all other sections `display: none` in
  print media - exact, because sections start on page boundaries, so
  each section paginates identically on its own), each section PDF is
  stamped with its own furniture at absolute page offsets
  (`pdf_furniture::stamp`), and the section PDFs are merged in document
  order (lopdf, already linked). Furniture text stays plain: margin
  boxes take strings, and the Rust stamp already leaves non-WinAnsi
  text off rather than printing "?". Desktop Print (the GTK print
  dialog, whose output folio never sees) still gets no furniture -
  unchanged; the flash points to Export as PDF.
- **Model / round-trip**: new block kind `page` (block-schema.md),
  classified "figure" in BLOCK_CLASS, serialized as
  `::: page {#id}` + its header lines + `:::` (no body, no separator
  blank). Golden file `tests/golden/page-sections.md` stays
  byte-identical (invariant #2).

### Acceptance (planned)

- Unit: `tests/engine/doc.test.ts` (parse/serialize `::: page` blocks),
  `tests/render/page-furniture.test.ts` (section resolution with
  carry-forward; named-`@page` CSS; `:first` guard), Rust tests in
  `pdf_furniture.rs` (per-section stamp at absolute offsets, merge
  order).
- e2e: `tests/e2e/print.spec.ts` (marker invisible on screen,
  `break-before: page` in print media only, section classes on block
  elements, named `@page` rules in the host print stylesheet).
- WebKitGTK: `tests/webkitgtk/print-native.js` extended (print-media
  rules and section classes present; engine-matrix rule).
- Palette + help: "Insert page section" entry; `demo/help/printing.md`.
- First-contact eval: `evals/page-sections-first-contact.md`.
