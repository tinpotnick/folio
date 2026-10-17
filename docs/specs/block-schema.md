# Block schema spec (v1)

The document model. Everything else (editor, renderer, engine) is a
view or transformation of this structure.

## Schema

```yaml
Document:
  version: 1
  frontmatter:          # theme ref + closed-schema style overrides
  blocks: [Block, ...]  # ordered, addressable by anchor id

Block:
  kind: prose | heading | table | chart | diagram | callout
  id: string           # stable, used by refs (@regional-data)
  data: Table | Chart | Diagram | ...

Table:
  columns: [Column, ...]
  rows: [[Cell, ...], ...]      # snapshot always stored inline
  bindings: [Binding, ...]      # optional external sources
  Column:
    name: string
    type: text | number | date | select | formula | relation
    unit?: string
    format?: percent | currency | ...
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
   byte-identical.
3. **Recalc correctness:** editing any cell updates every dependent
   formula and chart with no user action.
4. **Theme closure:** a document + any conformant theme renders;
   documents contain zero style literals.
