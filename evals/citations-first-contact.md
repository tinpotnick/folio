---
name: citations-first-contact
feature: citations and the reference list (docs/specs/citations.md)
steps:
  - In a document without references, add a bibliography and put in a reference copied from a source like Google Scholar's "Cite › BibTeX" (use a real BibTeX entry).
  - Cite it in a paragraph, then cite it again with a page number.
  - Switch to a numbered citation style, then print or export.
  - Open the "An academic paper" example and follow a citation to its entry.
expected:
  - Bibliography and Citation are found from visible affordances (+ Insert › References, or Ctrl+K "cite" / "bibliography"); before any references exist, Citation explains where they come from.
  - The pasted entry appears formatted in the list once cited, and "not cited yet" before that; the citation reads like "(Knuth, 1984)" and with a page "(Knuth, 1984, p. 99)".
  - Switching to numeric renumbers citations and the list together; print shows plain citations and only cited entries.
  - Clicking a citation goes to its entry; the source keeps Pandoc syntax (`[@key]`) and nothing else.
---
# First-contact eval: citations

A new user writing a report with sources cites them the way a word
processor's reference manager would - without learning BibTeX or
Pandoc.
