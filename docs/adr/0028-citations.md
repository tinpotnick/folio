# ADR-0028: Citations - Pandoc syntax, BibTeX blocks, folio's own styles

Date: 2026-10-26

Status: accepted

## Context

Academic and professional reports cite sources. Three choices: the
citation syntax, where the references live, and who formats them.

## Decision

- **Syntax: Pandoc's** (`[@key, p. 12]`, `[@a; @b]`, `[-@key]`,
  `@key`). It is what Pandoc, Quarto and R Markdown read, so a folio
  document stays convertible with the standard tools, and it reads
  acceptably as plain text on GitHub.
- **References: a ```bibtex code block in the document**, not a
  sidecar `.bib` file and not CSL YAML in the frontmatter. BibTeX is
  what Google Scholar, Zotero, Mendeley and journal "Cite" buttons
  export, so references are pasted, never retyped. In the document,
  it renders offline and travels with the file (ADR-0005); as a code
  block, GitHub shows it readably. Pandoc users can point
  `--bibliography` at the same text.
- **Formatting: folio's own**, two styles - author-date (APA 7-like)
  and numeric (IEEE-like) - in `src/engine/citations.ts`, with a small
  BibTeX reader in `src/engine/bibtex.ts`. No new dependency.
  - Rejected: **citeproc-js**, the CSL reference implementation. It is
    dual-licensed CPAL-1.0 / AGPL-3.0, which does not sit well with
    folio's MIT licence (ADR-0026). It also brings XML styles and
    locale files, which would make the offline bundle heavier.
  - Rejected: **citation-js**, which formats through citeproc-js
    anyway.

## Consequences

- Two styles cover most reports; journals with house styles (Chicago
  notes, Harvard variants, Vancouver) are not exact yet. If CSL ever
  matters, a CSL processor with a permissive licence could replace the
  formatter behind the same `formatBibliography` / `formatCitation`
  seam without changing documents.
- A reader cannot parse every BibTeX corner case (nested `@string`
  arithmetic, exotic LaTeX). What it cannot read is reported under
  the list, not thrown.
