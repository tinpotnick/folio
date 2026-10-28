---
name: in-app-help-first-contact
feature: in-app-help
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: Q3 Field Operations Review").
  - Without instructions, look for a way to learn the app.
  - Click the visible "?" toolbar button.
  - Find how to make a stacked chart, without browsing the whole list.
  - With that topic still showing, make the change it describes to a chart in the document.
  - Go back to all topics; read how to open and save documents; close help.
  - Press the ? key with nothing focused; close with Esc.
  - From Ctrl+K, search "keyboard shortcuts" and pick the help topic.
  - In the help, click an outside link (Graphviz, Vega-Lite, strudel.cc).
expected:
  - The Help control is visible in the toolbar on both web and desktop.
  - Help opens beside the document, which stays visible and editable;
    in a narrow window it slides over the document, below the toolbar.
  - The search box finds the Charts topic from "stacked"; the topic
    opens at its top.
  - "All topics" returns to the grouped list; the close button, ? and
    Esc all put the panel away and focus returns to the app.
  - The Ctrl+K pick opens the panel at that topic's title, with the
    panel's header (and its close button) fully in view.
  - Pressing ? while typing in the source editor does NOT open help.
  - An outside link in the help opens: a new tab on the web, the
    system browser in the desktop app; the document stays as it was.
---

# First-contact eval: in-app help

An agent playing a new user, using only visible affordances, must be
able to find a help topic, follow it while working on their document,
browse the rest, and dismiss the panel - in both the web and desktop
hosts.
