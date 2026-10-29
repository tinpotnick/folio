# Compute blocks (Python)

## Status: proposed (2026-11-20, ADR-0030)

## Decision

A ```` ```python ```` fence WITH binding info renders as its OUTPUT
DATASET: a themed table produced by Python code that runs in a
sealed Pyodide worker. The output is the figure; the code is how
you edit it. A ```` ```python ```` fence WITHOUT binding info is an
inert, highlighted code block, exactly as on GitHub. The language
tag never changes meaning: runnability comes from the binding info,
not from the tag — so a document can show Python code (a snippet in
a tutorial) and runnable Python (a forecast) under the same tag,
and the reader cannot tell them apart on the page.

## Contract

- **Model**: no new block kind: `{ kind: "code", lang: "python" }`
  with fence info, so the fence round-trips byte for byte.
- **Binding** (matches JSCAD's `params=` info, specs/jscad-blocks.md):
  ```` ```python data=@budget,@rates out=forecast,sensitivity ````.
  - `data=@a,@b` binds ONE OR MORE input datasets (comma list;
    the same `@id` graph formulas and charts use). Editing any
    bound dataset recalculates the block. The header's **data**
    picker adds and removes bound datasets, exactly as JSCAD's
    does, with multiple entries.
  - `out=forecast,sensitivity` declares ONE OR MORE output
    datasets (comma list, each entering the document's `@id`
    graph; charts, formulas and other compute blocks may
    reference any of them). Omitted `out` is an error: a compute
    block without outputs has nothing to render (the error is
    the figure's text, like a Model error).
  - A plain ```` ```python ```` fence with NO info stays inert; the
    fence info is what makes the block compute, and only the
    header's data pickers write it.
- **Inputs**: each bound dataset arrives as a named variable in
  the script — `budget` for `@budget`, `rates` for `@rates` (the
  id, sans `@`, as a Python identifier; a colliding or
  non-identifier id is a Compute error naming it). Each is a list
  of dicts keyed by column name (units live in the schema, not
  the values) — the same live, recalculated rows a chart would
  query. A missing dataset is a Compute error naming it (JSCAD's
  error shape). A dict `inputs` of all bound datasets is also
  provided for generic scripts.
- **Outputs**: the script's return value becomes the declared
  output datasets. Accepted returns, matched against `out=` by
  position: a table value for ONE `out` — a list of dicts
  (columns inferred from the first row, types inferred as table
  import does) or a `{columns, rows}` dict with explicit
  names/types/units; a TUPLE of table values for several `out=`
  names. Anything else, or a count mismatch with `out=`, is a
  Compute error. Each output enters the document's `@id` graph:
  charts, formulas and other compute blocks may reference them,
  and editing any input recalculates them silently
  (`refreshDependents`, the one place dependents redraw). The
  figure is the FIRST output table; the others render as their
  own themed tables stacked under it, all one figure.
- **No execution affordances** (ADR-0030): the figure is the themed
  output table. No run button, no execution state, no cell chrome.
  Editing the code (or the input dataset) recalculates 600 ms after
  typing pauses, the old table dimming while it runs — the JSCAD
  redraw pattern. stdout/stderr appear only in the header, never as
  document content.
- **Header** (the ONE inspector contract): click the table to reveal
  the header (language picker, a **data** picker ("No data" or
  `@dataset`), the **out** name, and errors) AND the code; click
  away to hide both.
- **Sandbox** (the JSCAD pattern, sealed harder): a module worker
  with `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `importScripts`, IndexedDB, caches, channels and nested workers
  removed; no `require`. A script running past 10 seconds is
  terminated. Only the result table comes back. numpy/pandas are
  importable from Pyodide's bundled packages; anything needing the
  network is refused, by design.
- **Determinism** (ADR-0030): the script must not read the clock or
  unseeded randomness. The guard is a Compute error in the header,
  not document content.
- **Offline render (ADR-0005)**: the output SNAPSHOT is stored in
  the document (a dataset block adjacent to the fence, serializer
  round-trip identity holding), so the document renders with the
  runtime unloaded and the network cut. The snapshot is source of
  truth until recalc replaces it. On GitHub the fence is code and
  the snapshot is a readable Markdown table.
- **Print** (ADR-0025): the output table prints; the code does not
  (the header is hidden). Export to PDF prints the report, not the
  notebook.
- **Insert**: the palette's **Insert a compute block (Python)**
  adds a starter (`data` bound to the nearest dataset, `out`
  suggested as `<name>-out`); "Python" remains one entry in the
  language picker, and adding `data=` via the header is what
  makes it compute.
- **Load budget**: Pyodide loads lazily on the FIRST compute block,
  in its own worker chunk; documents without one pay nothing (the
  Mermaid/KaTeX/Vega/JSCAD pattern). It is the largest lazy chunk;
  the welcome page shows a one-line note while it loads.

## Acceptance

- Unit: `tests/engine/compute-parse.test.ts` (fence info parsing,
  round-trip identity, snapshot serialization),
  `tests/compute/evaluate.test.ts` (return shapes, column
  inference, errors: no return, wrong shape, timeout, missing
  dataset, missing `out`).
- e2e: `tests/e2e/compute.spec.ts` (the sample computes; editing
  `@budget` recalculates `@forecast` and its chart; code hidden
  until click; errors as figure text; an endless loop stopped at
  10 s; no network in the sandbox; plain ```` ```python ```` stays
  inert; palette insert).
- Sample: `demo/examples/compute.md` (a budget feeding a
  regression whose output feeds a chart). First-contact eval:
  `evals/compute-first-contact.md`.
- Golden tests must cover a sample with one compute block before
  the ADR moves to accepted.
