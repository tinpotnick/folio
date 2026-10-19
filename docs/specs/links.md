# Links

## Status: accepted (2026-10-18)

## Decision

Standard inline Markdown links - `[label](url)` - in prose
blocks. Clicking a link FOLLOWS it (document links load in
place; external URLs open a new tab); the toolbar's link button
is the editing affordance, with a floating control (the table
inspector's spirit, inline) to change or remove the link.

## Contract

- **Syntax**: `[label](url)` inside prose; labels carry the
  other inline formats (`[**bold** label](url)` round-trips).
  Image syntax `![alt](url)` is NOT a link (inline images stay
  literal text; a whole-line `![]()` is the image block, ADR-
  0013). Links in PROSE only: headings derive from textContent,
  so a link inside a heading flattens on the next sync - keep
  links in paragraphs (documented behavior, matching the other
  inline formats).
- **Rendering**: `<a href>` in the article; styled by the theme;
  the URL is attribute-safe (quotes have no business in a URL and
  are stripped).
- **Following**: clicking a link never places the caret - the
  component dispatches a composed `folio-link` event with the
  href, and the HOST decides what opening means (ADR-0006: the
  component is embeddable; navigation is host policy):
  - the demo host loads `.md` paths in place (same loader the
    examples use) and opens anything with a protocol in a new
    tab (`noopener`); a failed fetch is a visible flash, never a
    broken document.
  - **Desktop caveat**: relative document links resolve against
    the PAGE in the web demo; the desktop host does not yet
    track the current document's directory (the Rust bridge
    returns text, not path), so desktop link-following needs
    that bridge extension - tracked as a follow-up.
- **Editing**: the toolbar's link button (chain icon, fmt group).
  With a selection: wrap it as a link. With the caret in a link:
  open the link control. With a bare caret: insert a
  `[link text](url)` template. In the Markdown view it wraps the
  selection directly.
- **The link control**: a floating bar under the link - label
  and URL inputs, Apply (writes the DOM; structural sync derives
  the source), Remove link (unwraps, keeping the text). Enter
  applies, Esc closes, any click outside closes. In the Markdown
  view, the raw text is the control.
- **Sample document**: the "More examples" section links all
  four shipped examples - the north-star demo of a document that
  cites other documents.

## Non-goals

- Reference links (`[label][ref]`), autolinks (`<url>`), and
  link titles (`[label](url "title")`) - plain inline links
  cover the workflow; add on demand.
- Anchors within a document (`#section` targets) - needs a
  section-id model; the section browser already covers
  navigation.

## Acceptance

- Unit: `tests/render/inline.test.ts` (link render + round-trip,
  nested label formats, escaping, image syntax is not a link).
- e2e: `tests/e2e/links.spec.ts` (the sample's example links;
  click loads the linked document in place; the link button +
  control edit; Remove keeps the text; external URL opens a new
  tab). Outline/golden updated for the sample's new section.
- First-contact eval: `evals/links-first-contact.md`.
