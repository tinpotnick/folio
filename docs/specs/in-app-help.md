# In-app help

## Status: accepted (2026-10-18); a docked panel of topics (2026-10-28)

## Decision

Help is folio documents, not a separate help system. The host page
ships `demo/help/` - one plain semantic Markdown document per topic,
offline-renderable per ADR-0003, listed by `demo/help/index.md` - and
renders them through the same `<folio-doc>` component (ADR-0006). No
new render path, no new dependency (ADR-0007).

Help DOCKS beside the document rather than covering it, so a user can
read how to do something and do it at the same time. (It was one
700-line document in a modal: a Ctrl+K jump scrolled the modal itself,
hiding its header behind a sliver of the Close button, and landed
short of the section; every open rendered all of it.)

## Contract

- **Topics**: `demo/help/<topic>.md`, each a folio document whose H1 is
  its title. `index.md` lists them under group headings (`## Tables
  and data`) as `- [Title](file.md) - what it covers`; the list is the
  browse view and the source of the topic titles and groups. On
  GitHub the folder reads the same way. A link between topics is a
  plain relative link (`[Tables and datasets](tables.md)`).
- **Panel**: `<aside id="help-panel">` in the layout, right of the
  document, 420px wide, under the toolbar, scrolling on its own. At
  1000px and narrower it slides over the document (fixed, a shadow)
  instead of squeezing it. It never prints.
- Its head: **‹ All topics** (in a topic), the "Help" label, and a
  close button (x); below it a **search box**. The topic renders
  in `<folio-doc id="help-doc">` a size smaller than the document
  (zoom 0.86), its paper filling the panel.
- **Opening**: the **?** toolbar button toggles the panel (it shows
  pressed while open); `F1` and the `?` key toggle it too. `?` is a
  character, so only when the user is not typing (the guard pierces
  the component's shadow root); `F1` types nothing, so it works
  everywhere, the standard help key (2026-10-29). Opening on the
  topic list focuses the search box - except by F1 mid-typing, which
  leaves the caret where it was, so F1 again closes help and typing
  carries on.
  The panel keeps its topic between openings.
- **Closing**: the close button, the toolbar button, `F1`, `?`, or `Esc`
  from inside the panel. `Esc` in a search box with text clears it
  first.
- **Search**: the box lists matching topics as you type - a title
  containing the words first, then topics whose text does (the
  palette's word matching: whole words, not scattered letters) -
  with each topic's group. Enter opens the first. Nothing matching
  says so.
- **Palette**: every topic is a `Help: <title>` entry, found by its
  title or its text (searching "stacked" finds Charts). Running one
  opens the panel at the top of that topic. "Open help" opens the
  panel. Topics are fetched once at start; a palette opened before
  they arrive lists them when they do.
- **Links**: a link to another topic opens it in the panel; any other
  link follows like the document's own (an example opens as the
  document, the panel staying open; a web address opens outside).
- Help is read-only in intent: a separate component instance; toolbar
  actions and edits target the user's document, which stays editable
  while help is open.
- The help content stays plain semantic Markdown - not a channel for
  styling or behavior (AGENTS.md non-negotiables). A new user-visible
  action is documented in the topic it belongs to (AGENTS.md
  "Definition of done").

## Acceptance

- Unit: `tests/engine/help-topics.test.ts` - every topic round-trips
  byte for byte, and the index lists exactly the topic files.
- e2e: `tests/e2e/app.spec.ts` ("in-app help": beside the document,
  topics and back, editing alongside, search, Esc, `?`/F1 toggling and the
  typing guard, the narrow overlay), `palette.spec.ts` (a topic opens
  at its top with the panel head in view), `print.spec.ts` (never
  prints), `help-links.spec.ts`, `subfolder.spec.ts`.
- First-contact eval: `evals/in-app-help-first-contact.md`.
