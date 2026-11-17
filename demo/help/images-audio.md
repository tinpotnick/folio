# Images and audio

- **Images** embed in the document as data URIs - a folio document
  is one file that renders fully offline. Pick a picture with the
  **+ Insert › Image** (or the command palette); the file name seeds the
  alt text. A basic image is stored as standard Markdown
  `![alt](data:...)` on its own line - the file stays portable plain
  Markdown; adding a caption in the inspector upgrades it to a
  `::: image` directive (with an anchor id). You can also hand-type
  `![alt](src)` on its own line. An external `http(s)://` image renders
  when reachable (alt text otherwise) and is never fetched on its own -
  use the inspector's **Download and embed** (or the palette command)
  to inline it as a data URI. Click an
  image to edit its alt, caption, or replace the file from its
  inspector bar - and **Crop / zoom** to cut a region out (drag on
  the image, zoom to place it precisely, Apply); an external image
  shows **Download and embed** to inline it. Click the image once
  and press Backspace or Delete to remove it. Files over 8 MB are refused (resize first); floating
  images and text wrap are deliberately not supported - layout
  belongs to the theme, not the document. Large pictures (over
  400 KB) are downscaled on insert - longest edge 2048 px, re-encoded
  to roughly 400 KB - because the embedded data URI is one huge line
  in the Markdown source and laying it out is slow; the status bar
  says "resized to fit" when that happens. To keep the original
  bytes instead, search **"original image"** in the palette (Ctrl+K)
  and run **"Keep original image quality"** - the 8 MB ceiling
  applies either way.
- **Audio** embeds like an image - a recorded sound is media, the
  temporal sibling of a picture. Pick a file with **+ Insert ›
  Audio clip** (or hand-type an `::: audio` directive with a `src`);
  it plays in the page through the browser's own audio controls.
  Click the figure to edit its alt text, caption, or replace the
  file; click once and press Backspace or Delete to remove it.
  The same 8 MB ceiling applies - and for sounds you want to
  SYNTHESIZE, use a Strudel block instead. **+ Insert › Record
  audio** records straight from the microphone: while it records,
  the toolbar shows a pulsing **Recording · Stop** button and the
  status bar counts; click it to stop, and the clip embeds in
  place. The browser asks for
  microphone permission the first time.
