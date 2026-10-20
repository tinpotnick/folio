# Themes

## Status: accepted (2026-10-20, ADR-0002's named references made real)

## Decision

The frontmatter's `theme:` line always referenced a theme by
name - now names exist. A theme is a PRESET of typed theme
values (`THEME_PRESETS` in src/render/theme.ts); the document's
own style keys override it KEY BY KEY (explicit always wins).
Unknown names fall back to the default look - a document may
outlive a theme.

## Shipped themes

| Name | Look |
|---|---|
| `default` | folio's own look (the fallback) |
| `corporate-report` | Source Serif, booktabs tables, corporate blue palette |
| `technical` | sans-serif, 15px body, plain tables, ink palette |
| `editorial` | Georgia, 19px body, large display headings, warm palette |

## Switching

The document settings dialog's first field is the Theme select.
It writes the `theme:` frontmatter line through the same
parse/serialize pipeline as editing the YAML by hand; `default`
REMOVES the line. Individual settings (fonts, sizes, table
style, chart palette) still override the theme per key - the
sample document wears `corporate-report` but its charts stay
muted-blue because it sets `chart.palette: "muted"` explicitly.

## Acceptance

- e2e (`tests/e2e/settings.spec.ts`, "themes" describe): the
  select honors the document's theme on open; the four names are
  offered; switching to `editorial` re-renders a bare document
  (Georgia 19px) and writes `theme: editorial`; `default`
  removes the line while style keys survive.
- The chart dressing (docs/specs/chart-rendering.md) follows the
  theme palette, so a theme changes charts too.
