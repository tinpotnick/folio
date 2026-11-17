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
  - With the image still selected, click **Crop / zoom** in its
    bar, drag a rectangle over part of the picture, press
    **Apply crop**, then **Cancel** on a second pass.
  - Click the image once and press Backspace.
  - Press Ctrl+K, type "original image", press Enter (the
    "Keep original image quality" command), then insert a photo
    larger than 400 KB with the image button.
  - Switch to the Markdown source view.
expected:
  - The picked picture appears in the document immediately after
    the clicked paragraph; the alt is seeded from the file name.
  - The source shows the picture as standard Markdown
    ![alt](data:...) on its own line - a basic image stays standard;
    one file, offline. After the caption edit, the source upgrades
    to a ::: image {#image-...} directive carrying the caption.
  - The bar shows alt, caption, and a replace control; edits
    re-render the figure in place and reach the source; the bar
    hides on a click outside the figure (no close button).
  - Replacing the file swaps the picture; the source's src
    changes.
  - Crop mode shows a draggable selection over the image (zoom
    slider magnifies up to 4x); the selection's corner handles
    resize it and its centre handle moves it; on an image bigger
    than the view, holding the drag at an edge scrolls the view so
    the selection can extend past it. Apply (always visible in the
    bar) replaces the picture with just the selected region (a
    fresh data: URI in the source), Cancel leaves it untouched.
  - Backspace on the selected image removes the whole block from
    the document and the source.
  - Picking a huge file (over 8 MB) is refused with a visible
    message and the document is untouched.
  - By default a photo over 400 KB is downscaled on insert (status
    bar says "resized to fit"); with "Keep original image quality"
    toggled on in the palette, the same photo embeds at its original
    bytes - the source's data: URI is exactly as long as the file.
---
