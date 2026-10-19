---
name: math-first-contact
feature: math-blocks
steps:
  - Start the demo host. Switch to Markdown view and, anywhere in
    the source, type a block: a line with only `$$`, then
    `E = mc^2`, then a closing line with only `$$`.
  - Switch back to Document view.
  - Switch to Markdown view again, change the equation to
    `\int_0^1 x^2\,dx`, and switch back.
  - Type `\notacommand` as the math content and switch back once
    more.
expected:
  - The document shows the equation typeset (proper fractions,
    superscripts, math italics), centered as a figure.
  - The edited equation re-renders; the Markdown source always
    contains exactly the LaTeX typed, `$$` line, source, `$$`
    line.
  - The unknown command shows as red text inside the figure - the
    document does not crash and no parse error appears.
---
