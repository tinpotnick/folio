# Printing and PDF

- **Export as PDF**: the **Export** menu (the arrow-out-of-a-box
  button beside Save), or search "export" or "pdf" in the palette.
  In the desktop app a save dialog asks where, and folio writes the
  PDF itself — A4, the same pages Print makes, with every chart and
  diagram drawn. In a web browser, Export opens the print dialog:
  choose "Save as PDF" as the destination.
- Search "print" in the palette (Ctrl+K), or press **Ctrl+P** —
  folio prints the rendered document, never the source editor or
  the toolbar. To get a PDF, choose "Save as PDF" as the
  destination in the print dialog. Charts and diagrams print as
  crisp vector graphics, always on light paper - even in dark mode.
- Pages are numbered "Page n of N", with the title as a running
  header from page 2 (see [Document settings](settings.md) to turn them off).
  Exported PDFs have them unless you turn them off. **In the desktop
  app, Print (and the print dialog's "Print to File") leaves them
  off - use Export as PDF**, then print that file if you want paper.
  When printing from a browser, Chrome and Edge show them, Safari
  does not.
- **Change the header or footer partway through** (spec: page
  sections): search "insert page section" in the palette (Ctrl+K) to
  add a `::: page` block where your cursor is. It starts a new printed
  page, and from there on the pages carry what the block says -
  `header:`, `footer:`, `numbers: off`, and even `size:` /
  `orientation: landscape`. Keys you leave out carry over from the
  previous section, and page numbers keep counting ("Page 4 of 12",
  never restarting). Edit the block's lines in the Markdown view. On
  screen the block is invisible - page furniture only ever appears on
  paper.
- **Orientation for the whole document**: Document settings has an
  Orientation dropdown (Portrait/Landscape) next to Paper size - it
  writes the `page.orientation` style key. A `::: page` block can
  override it per section.
