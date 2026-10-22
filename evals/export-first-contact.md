---
name: export-first-contact
feature: export (docs/specs/print.md, ADR-0025)
steps:
  - Open the Q3 Sales Review example. Without help, get the document out as a PDF file.
  - Try again from the Markdown view, and again in a narrow (phone-width) window.
  - In the desktop app, export and open the PDF it wrote.
expected:
  - The user finds Export by looking for "Export" (toolbar or palette) - not by knowing that Print can make a PDF.
  - Web: the print dialog opens with a visible word on choosing "Save as PDF". Desktop: a save dialog asks where; no print dialog; the flash names the file written.
  - The PDF is the rendered document only (no toolbar or source), A4 with margins, every chart and drawing drawn - none caught mid-"Drawing…".
  - From the Markdown view and at phone width, Export still works (the document view, Export inside More tools).
---
# First-contact eval: export

A user who wants a PDF looks for Export. They must find it and get a
faithful PDF without knowing about print dialogs.
