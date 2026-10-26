# Citations and the reference list

## Status: accepted (2026-10-26, ADR-0028)

## Decision

Academic writing cites sources. folio reads Pandoc's citation syntax -
the de facto standard for citations in Markdown, also used by Quarto
and R Markdown - and takes its references from a ```bibtex block, the
format every reference manager and journal exports. Citations and the
reference list are formatted by folio itself, in one of two styles.

## Contract

- **Bibliography** (model): an ordinary fenced code block, language
  `bibtex` (or `biblatex`); on GitHub it stays readable BibTeX. It is a
  drawn block (drawn-blocks.md): the picture is the formatted list,
  and the BibTeX shows while the header is open. Several blocks pool
  their entries; the first definition of a key wins.
- **Reader** (`src/engine/bibtex.ts`, no UI dependencies): entries,
  `@string` macros, `#` concatenation, month macros; `@comment` and
  `@preamble` skipped. LaTeX becomes text: accents (`{\"o}` → ö),
  letters (`\ss`, `\o`), escapes, `--`/`---` dashes, `~`, `\LaTeX`,
  formatting commands keep their words, braces go. Names in either
  order, particles ("van"), `{Corporate Names}`, `and others`.
  BibLaTeX's `date`, `journaltitle`, `institution` are understood.
  Problems (a duplicate key, an unclosed entry) are listed under the
  list, never thrown.
- **Citations** (`src/render/inline.ts`): Pandoc's `[@key]`,
  `[@key, p. 12]` (any text after the key is the locator), `[see @a;
  @b]`, `[-@key]` (year only), and narrative `@key`. A bracketed
  cluster is always a citation; a bare `@key` only when its key is in
  the bibliography (so "@nick" stays text) and only after a space or
  opening punctuation (so URLs and emails are left alone). `@tbl:`,
  `@fig:`, `@sec:`, `@eq:` stay cross-references. The atom is
  `span.folio-cite[data-cite]`, holding its source verbatim, so the
  round trip is exact (its `*` and `_` are never read as emphasis).
- **Styles** (`src/engine/citations.ts`; style key `citation.style`,
  Document settings › Citation style):
  - `author-date` (default, APA 7-like): "(Knuth, 1984)", "(Knuth,
    1984, p. 99)", "(see Knuth, 1984; Tufte, 1983)", "Knuth (1984)",
    "(Satyanarayan et al., 2017)"; same names and year become 2020a /
    2020b. List: alphabetical, hanging indent, DOIs as
    `https://doi.org/` links.
  - `numeric` (IEEE-like): "[1]", "[2, p. 99]", "Knuth [2]"; numbered
    in order of first citation; list with the labels in a column.
  - Entry types: article, book, manual, incollection, inproceedings,
    conference, inbook, phdthesis, mastersthesis, thesis, techreport,
    report; anything else is formatted as misc (title, where, URL).
- **The list** shows the cited entries only (in the style's order).
  On screen only, entries not cited yet are named underneath ("Not
  cited yet"), and an empty bibliography explains where BibTeX comes
  from. Print shows the list alone.
- **Rendering** (`renderCitations`, alongside cross-references on
  render, input and change): every citation in reading order - the
  footnotes included - is filled in; a key the bibliography lacks
  shows as "(key?)" in grey, with a tooltip naming it. A citation's
  tooltip is its full reference. Clicking a citation scrolls to its
  entry and highlights it (`.folio-xref-target`).
- **Inserting**: + Insert › **Citation** / "Insert a citation" opens
  the palette on one entry per reference ("Cite: Knuth 1984 ·
  Literate Programming") and inserts `[@key]` at the cursor (a space
  is added after a word). With no references it says how to add
  them. + Insert › **Bibliography** / "Insert a bibliography" adds a
  "References" heading and a ```bibtex block with one real entry,
  at the end of the document (before the footnotes); with one
  already there, it goes to it instead.
- Print: citations are plain text in the text colour.
- Not yet: CSL styles, Chicago notes (citations as footnotes), a
  `references:` frontmatter list, `nocite`.

## Acceptance

- Unit: `tests/engine/citations.test.ts` (reader, syntax, both
  styles), `tests/render/citation-inline.test.ts` (atoms, round trip,
  what is left alone).
- e2e: `tests/e2e/citations.spec.ts`.
- Example: `demo/examples/paper.md` ("An academic paper"), with real
  references; it round-trips byte for byte.
- First-contact eval: `evals/citations-first-contact.md`.
