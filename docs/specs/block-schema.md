# Block schema spec (v1)

The document model. Everything else (editor, renderer, engine) is a
view or transformation of this structure.

## Schema

```yaml
Document:
  version: 1
  frontmatter:          # optional comment + theme ref + style overrides
  blocks: [Block, ...]  # ordered, addressable by anchor id

Frontmatter:
  comment?: string      # first `#` line of the YAML header, preserved
                        # verbatim; new documents carry a pointer to the
                        # app ("Best viewed in folio: …"), existing files
                        # are never retrofitted
  theme?: string
  style: [key, value][]

Block:
  kind: prose | heading | table | chart | diagram | callout | comment
  id: string           # stable, used by refs (@regional-data)
  data: Table | Chart | Diagram | ...

Every kind is classified exactly once as "text" or "figure" in
`BLOCK_CLASS` (src/engine/doc.ts) - a Record keyed by the kind union,
so adding a kind without classifying it is a compile error.
"text" blocks (prose, heading, list, code) are edited inline;
"figure" blocks (table, chart, motion, diagram, math, image, audio,
footnotes, toc, comment) render as contenteditable=false elements,
so the caret can only sit at their edges. One predicate
(`isFigureBlock`) drives every edge behavior in the component: Enter
with a figure selected opens a new paragraph AFTER it, ArrowDown past
a trailing one appends a paragraph, and clicking below a trailing one
offers the same - a new block kind classified "figure" gets all three
for free (docs/specs/figure-inspectors.md for the reveal contract).

Comment (spec: docs/specs/comments.md) - a review block, serialized as
`::: comment {#c-1}` with known `key: value` header lines (anchor,
quote, author, created, resolved, in-reply-to), then the free-text
body until the closing `:::`:
  id: string           # e.g. c-1; replies point at it (in-reply-to)
  anchor?: string      # block id (or heading slug) commented on
  quote?: string       # quoted text inside the anchor, for highlight
  author?: string
  created?: string     # ISO date
  resolved?: boolean
  replyTo?: string     # comment id this replies to
  text: string         # the comment body

Table:
  columns: [Column, ...]
  rows: [[Cell, ...], ...]      # snapshot always stored inline
  bindings: [Binding, ...]      # optional external sources
  Column:
    name: string
    type: text | number | date | datetime | select | formula | relation
    # typed (non-text) cells are validated against the type in the
    # editor (src/engine/cellvalidate.ts): an invalid value is underlined
    # in the error colour - see specs/spellcheck-grammar.md "Typed
    # columns"; typed cells are never spell-checked (data, not prose).
    unit?: string
    format?: percent | currency | ...
    hidden?: true      # render-time only: not drawn, still in the data
                         # (formulas, charts, dataset browser see it)
  Cell reading is column-typed (2026-11-04): a NUMBER (or other
  non-text) column coerces a bare numeral to a number; TEXT and DATE
  columns always read text, so a leading-zero identifier like
  "01632960123" (a CDR caller id) keeps its zero across save/reload -
  the Markdown source may show it bare, the column type decides.
  Binding:
    kind: csv | json-api | peer  # peer = table in another embedded doc
    descriptor: string           # connection metadata
    mode: manual | on-open       # never required for render

Chart:
  source: table-id
  query: {select, filter, group, aggregate, sort}
  type: bar | line | scatter | ...
  caption: string
```

## Invariants (these are the contract; tests must keep them green)

1. **Offline render:** any document renders fully with the network
   cut off. Bindings are enhancement; snapshots are source of truth.
2. **Round-trip identity:** parsed document -> serialized document is
   byte-identical. Empty prose blocks round-trip too: the serializer
   joins blocks with a blank line, so n consecutive empty prose
   blocks serialize to a run of 2n blank lines and parse back to n
   empty blocks (floor(k/2) for a run of k). Leading and trailing
   blank runs are plain separators and carry no blocks.
3. **Recalc correctness:** editing any cell updates every dependent
   formula and chart with no user action.
4. **Theme closure:** a document + any conformant theme renders;
   documents contain zero style literals.

## Enter at block edges

Enter mid-prose splits the paragraph natively (every engine). At a
block's edge the component inserts instead: **Enter with the caret at
the end of a heading, or at a non-editable figure's edge (table,
chart, motion), opens a new empty paragraph AFTER that block** and
focuses it - there is otherwise no way to add a line past the title
or a trailing table without the Markdown view (WebKitGTK does nothing
natively at a heading's end). Enter inside a table cell navigates
cells instead (docs/specs/table-keyboard.md).
