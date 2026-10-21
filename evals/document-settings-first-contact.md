---
name: document-settings-first-contact
feature: document-settings
steps:
  - Open the document settings and pick the "Editorial" theme
    card; press Apply.
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations"). Click the sliders
    button in the toolbar (or press Ctrl+K and search "settings").
  - Change the body font to Literata and Apply.
  - Switch to Markdown view and look at the header.
  - Reopen the dialog. Set H1 to start a new page and the table
    style to plain. Apply.
  - Reopen once more and set the body font back to default. Apply.
expected:
  - The dialog shows typed controls with the current values
    preselected.
  - After the font change, the document re-renders in Literata
    and the header shows `body.font.family: "Literata"` - the
    same edit as typing it in the YAML. The Overrides note counts
    it as overriding the theme.
  - The page-break and table-style choices appear in the header as
    `pagebreak.h1: "before"` and `table.style: "plain"` and the
    rendered table switches to a full grid.
  - Setting a field back to default REMOVES the key from the
    header; untouched keys keep their original order.
---
