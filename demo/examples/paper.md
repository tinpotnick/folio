---
theme: academic
---

# Documents that carry their data

*A short paper written in folio. It shows citations, a reference
list, footnotes, numbered tables and figures with cross-references,
and an equation. The measurements are illustrative.*

[[_TOC_]]

## Introduction

Most reports are written in one program and computed in another. The
numbers are pasted in as pictures or as frozen text, and the document
no longer knows where they came from. Knuth's argument for literate
programming [@knuth1984] went the other way: a program should be
written to be read, with the explanation and the code in one file.
This paper argues for the same idea in ordinary reports: the data
lives inside the document, as a typed table, and every chart is a
query over it.[^scope]

## Background

Tufte's rule was to show the data and to erase what is not data
[@tufte1983, pp. 91--93]. The grammar of graphics put that on a
formal footing: a chart is a mapping from the columns of a dataset
to visual properties [@wilkinson2005]. Vega-Lite turned the grammar
into a JSON specification that a program can write and a browser can
draw [@satyanarayan2017].

On the writing side, plain-text markup made documents readable
without their tools. @gruber2004 designed Markdown so that the source
reads as text; CommonMark later pinned down its grammar
[@macfarlane2024]. LaTeX had already shown that structure, not
appearance, is what an author should write [@lamport1994, ch. 1].
Computational notebooks then put code, output and prose in one
publishable file [@kluyver2016].

## Approach

folio keeps the source a Markdown file, and adds three ideas, listed
in @tbl:choices.

::: table {#choices}
caption: "Design choices and what each one buys"
columns:
  - {name: choice, type: text}
  - {name: benefit, type: text}
data:
  - ["Tables are typed datasets", "Charts and formulas can query them"]
  - ["Charts are queries", "A chart cannot drift from its table"]
  - ["Style lives in themes", "The source stays semantic and portable"]
:::

A chart therefore has no numbers of its own. If the table it draws
from changes, the chart changes with it (see @sec:an-illustration).

## An illustration

@tbl:effort gives an illustrative comparison of the time spent
updating a monthly report when its numbers change. The figures are
made up for this example.

::: table {#effort}
caption: "Minutes to update a monthly report (illustrative)"
columns:
  - {name: step, type: text}
  - {name: copied, type: number, align: right}
  - {name: linked, type: number, align: right}
data:
  - ["Update the table", 12, 12]
  - ["Redraw the charts", 25, 0]
  - ["Check the text", 15, 6]
:::

::: chart {#effort-chart}
source: @effort
query: {select: [step, copied, linked]}
type: bar
caption: "Time per step, copied numbers against linked ones"
:::

@fig:effort-chart shows where the saving comes from: once the charts
are queries, redrawing them costs nothing. If a report has $n$ charts
and redrawing each takes $t$ minutes, the time saved each month is

$$
S = n \cdot t
$$

which grows with every chart added.[^check]

## Discussion

Keeping the data in the document has costs. Very large datasets do
not belong in a text file, and a reader without folio sees the table
as text, not as a chart. The format is designed so that this still
reads well: on GitHub the tables are YAML, the charts are short
descriptions, and the citations stay as `[@key]`, which Pandoc
understands [@macfarlane2024].

## References

```bibtex
@article{knuth1984,
  author  = {Knuth, Donald E.},
  title   = {Literate Programming},
  journal = {The Computer Journal},
  volume  = {27},
  number  = {2},
  pages   = {97--111},
  year    = {1984},
  doi     = {10.1093/comjnl/27.2.97}
}

@book{tufte1983,
  author    = {Tufte, Edward R.},
  title     = {The Visual Display of Quantitative Information},
  publisher = {Graphics Press},
  address   = {Cheshire, CT},
  year      = {1983}
}

@book{wilkinson2005,
  author    = {Wilkinson, Leland},
  title     = {The Grammar of Graphics},
  edition   = {2nd},
  publisher = {Springer},
  address   = {New York},
  year      = {2005},
  doi       = {10.1007/0-387-28695-0}
}

@article{satyanarayan2017,
  author  = {Satyanarayan, Arvind and Moritz, Dominik and Wongsuphasawat, Kanit and Heer, Jeffrey},
  title   = {{Vega-Lite}: A Grammar of Interactive Graphics},
  journal = {IEEE Transactions on Visualization and Computer Graphics},
  volume  = {23},
  number  = {1},
  pages   = {341--350},
  year    = {2017},
  doi     = {10.1109/TVCG.2016.2599030}
}

@misc{gruber2004,
  author = {Gruber, John},
  title  = {Markdown},
  year   = {2004},
  url    = {https://daringfireball.net/projects/markdown/}
}

@misc{macfarlane2024,
  author = {MacFarlane, John},
  title  = {{CommonMark} Spec, Version 0.31.2},
  year   = {2024},
  url    = {https://spec.commonmark.org/0.31.2/}
}

@book{lamport1994,
  author    = {Lamport, Leslie},
  title     = {{\LaTeX}: A Document Preparation System},
  edition   = {2nd},
  publisher = {Addison-Wesley},
  address   = {Reading, MA},
  year      = {1994}
}

@inproceedings{kluyver2016,
  author    = {Kluyver, Thomas and Ragan-Kelley, Benjamin and others},
  title     = {Jupyter Notebooks -- a publishing format for reproducible computational workflows},
  booktitle = {Positioning and Power in Academic Publishing: Players, Agents and Agendas},
  editor    = {Loizides, Fernando and Schmidt, Birgit},
  publisher = {IOS Press},
  pages     = {87--90},
  year      = {2016},
  doi       = {10.3233/978-1-61499-649-1-87}
}
```

[^scope]: The scope here is reports: documents written to be read,
    not programs. folio deliberately has no way to run code.
[^check]: The citation style follows the document's settings: change
    it to numeric and every citation and the reference list renumber.
