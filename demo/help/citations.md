# Citations and references

- **+ Insert › Bibliography** (or search "bibliography") adds a
  **References** heading and a reference list. Click the list to see
  its source: BibTeX, the format Google Scholar ("Cite" › BibTeX),
  Zotero, Mendeley and journal sites all export. Paste entries there.
- **+ Insert › Citation** (or search "cite") lists the references; pick
  one and folio writes `[@knuth1984]` at your cursor, shown as
  "(Knuth, 1984)". For a page, type it after the name: "Knuth p. 99"
  gives "(Knuth, 1984, p. 99)". Citing again straight after a citation
  adds to it: "(Knuth, 1984; Tufte, 1983)". The reference list shows
  only what is cited, sorted and formatted for you; entries not cited
  yet are listed in grey underneath, on screen only.
- Typing works too, in Pandoc's syntax: `[@knuth1984, p. 99]` adds a
  page, `[see @a; @b]` cites two, `[-@knuth1984]` gives the year alone,
  and `@knuth1984` in a sentence reads "Knuth (1984)".
- **Citation style** in document settings: author-date, APA-like
  "(Knuth, 1984)", or numeric, IEEE-like "[1]" - the citations and the
  list renumber together. Click a citation to go to its entry.
- A citation whose key is not in the bibliography shows as
  "(key?)" in grey; hover it to see which key is missing.
