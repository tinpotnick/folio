---
name: toolbar-first-contact
feature: toolbar (docs/specs/toolbar.md)
steps:
  - Start the demo host on a document (a later launch, so a blank page) at 1280x800.
  - Without help, make a heading, a paragraph, a bulleted list, then insert a table, a chart and an equation.
  - Turn dark mode on and keep typing.
  - Narrow the window to 1000, 800 and 390 pixels wide; at each, find dark mode, document settings and help.
  - Start recording audio, then stop it.
  - Start a new document.
expected:
  - Every control is visible or one click away at every width; nothing sits past the edge of the bar and nothing needs sideways scrolling.
  - The text style menu names the style at the caret and sets it; the Insert menu lists every insert with a readable name.
  - A click on a toolbar button (dark mode included) does not lose the caret - typing carries on in the document.
  - While recording, the bar visibly says so and offers Stop.
  - The toolbar looks like one professional, consistent bar in light and dark: aligned heights, consistent icons, no stray pills or clipped menus.
  - The window/tab title names the document.
---
# First-contact eval: toolbar

An agent playing a new user, using only visible affordances, must be
able to find and use every toolbar action at any window width.
