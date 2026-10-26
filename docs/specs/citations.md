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
  `@preamble` skipped (text outside entries, like `%` comments, is
  ignored). LaTeX becomes text: accents (`{\"o}` → ö),
  letters (`\ss`, `\o`), escapes, `--`/`---` dashes, `~`, `\LaTeX`,
  formatting commands keep their words, braces go. Names in either
  order, particles ("van"), `{Corporate Names}`, `and others`.
  BibLaTeX's `date`, `journaltitle`, `institution` are understood.
  Problems are listed under the list with their line, never thrown: a
  duplicate key; an entry or a braced value left open (it ends where
  the next `@entry{` line starts, so no field ever crosses into another
  reference); a key a citation cannot name (`schr{\"o}dinger1935` -
  rename it), which is left out.
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
    2020b; several works in one citation read alphabetically. List:
    alphabetical, hanging indent, journal and book titles in title
    case (only all-lower-case words change), DOIs as
    `https://doi.org/` links.
  - `numeric` (IEEE-like): "[1]", "[2, p. 99]", "Knuth [2]"; numbered
    in order of first citation, ascending within a citation; list with
    the labels in a column.
  - Entry types: article, book, manual, incollection, inproceedings,
    conference, inbook, phdthesis, mastersthesis, thesis, techreport,
    report; anything else is formatted as misc (title, where, URL).
- **The list** shows the cited entries only (in the style's order).
  On screen only, entries not cited yet are listed underneath,
  formatted and greyed ("Not cited yet") so a paste can be checked,
  and an empty bibliography explains where BibTeX comes from. Print
  shows the cited list alone - never the BibTeX source or any
  inspector bar, even one left open (a print rule for every figure).
- **Editing the bibliography**: its header says where BibTeX comes
  from; a click on the list puts the caret at the end of the source,
  ready to paste; a paste into the untouched example entry replaces
  it. Esc hides the source (the inspector contract, for every code
  figure).
- **Rendering** (`renderCitations`, alongside cross-references on
  render, input and change): every citation in reading order - the
  footnotes included - is filled in; a key the bibliography lacks
  shows as "(key?)" in grey, with a tooltip naming it. A citation's
  tooltip is its full reference. Clicking a citation scrolls to its
  entry and highlights it (`.folio-xref-target`).
- **Inserting**: + Insert › **Citation** / "Insert a citation" opens
  the palette on one entry per reference ("Cite: Knuth 1984 ·
  Literate Programming (@knuth1984)", badge "Reference") and inserts
  `[@key]` at the cursor - a space is added after a word before it and
  before a word after it. A page typed after the name ("Cite: Knuth
  p. 99"; also pp., ch., sec., para., fig., vol., n.) becomes the
  locator, `[@knuth1984, p. 99]`, as the palette's footer says. Right
  after another bracketed citation, it joins it: `[@a; @b]`. A bare
  "cite" search ranks the command above the references. With no
  references it says how to add them.
- **Typed citations** (and cross-references, footnote numbers) become
  their atoms when the caret leaves the paragraph (`hydrateInline`);
  the source is unchanged. + Insert › **Bibliography** / "Insert a bibliography" adds a
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
