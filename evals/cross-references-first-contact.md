---
name: cross-references-first-contact
feature: cross-references (docs/specs/cross-references.md)
steps:
  - Open the Q3 Sales Review example; find the numbered tables and figures and the references to them in the text, and follow one.
  - In the same report, write a sentence that refers to the product-mix table without knowing any syntax.
  - Delete the first table's caption; see what happens to the numbers.
expected:
  - Captions read "Table 1. …", "Figure 1. …", numbered in reading order.
  - The user finds how to refer to a table from visible affordances (+ Insert › Cross-reference, or Ctrl+K "reference"), and the text then reads "Table 2".
  - Clicking a reference goes to its table or figure.
  - Numbers and references update by themselves when things change.
---
# First-contact eval: cross-references

A new user refers to tables and figures by number, without learning
the syntax, and the numbers stay right.
