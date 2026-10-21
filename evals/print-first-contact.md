---
name: print-first-contact
feature: print
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations").
  - Press Ctrl+K, type "print", and press Enter (or press Ctrl+P
    directly). The OS print dialog opens.
  - In the dialog, choose "Save as PDF" as the destination and
    save.
  - Open the print dialog again while in Markdown view.
  - Set H2 to start a new page in Document settings, then print
    again.
expected:
  - The printout/PDF shows the rendered document only: no toolbar,
    no sidebar, no status bar; A4 with sensible margins; the chart
    prints as crisp vector graphics.
  - Printing from Markdown view prints the rendered document (the
    view switches before the dialog opens), not the source text.
  - With the page-break setting on, each H2 heading starts on a
    fresh page; the document's first heading does not produce a
    blank first page.
---
