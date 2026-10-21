---
name: images-first-contact
feature: images
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review") and click into
    a paragraph.
  - Click the image button in the insert group (between diagram
    and equation) and pick a PNG from the file dialog.
  - Click the inserted image; in the bar that appears, change the
    alt text and press Enter, then the caption and press Enter.
  - Click the sample document's cover image, then use the bar's
    file control to replace it with another picture.
  - Click the image once and press Backspace.
  - Switch to the Markdown source view.
expected:
  - The picked picture appears in the document immediately after
    the clicked paragraph; the alt is seeded from the file name.
  - The source shows an image directive (::: image {#image-...})
    with the picture embedded as a data: URI - one file, offline.
  - The bar shows alt, caption, and a replace control; edits
    re-render the figure in place and reach the source; the bar
    hides on a click outside the figure (no close button).
  - Replacing the file swaps the picture; the source's src
    changes.
  - Backspace on the selected image removes the whole block from
    the document and the source.
  - Picking a huge file (over 8 MB) is refused with a visible
    message and the document is untouched.
---
