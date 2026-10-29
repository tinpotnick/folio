# Images and audio

- **Images** embed in the document as data URIs - a folio document
  is one file that renders fully offline. Pick a picture with the
  **+ Insert › Image** (or the command palette); the file name seeds the
  alt text. You can also hand-type the standard form
  `![alt](https://example.com/cat.png)` on its own line - folio
  upgrades it to an image directive on the next save. Click an
  image to edit its alt, caption, or replace the file from its
  inspector bar; click it once and press Backspace or Delete to
  remove it. Files over 8 MB are refused (resize first); floating
  images and text wrap are deliberately not supported - layout
  belongs to the theme, not the document.
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
