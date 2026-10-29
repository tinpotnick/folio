# Compute blocks (Python)

## Status: accepted (2026-10-29, ADR-0030 revised)

## Decision

A ```` ```python ```` fence with `data=` and/or `out=` runs as Python
in a sealed Pyodide worker. It READS datasets (`data=`) and PUBLISHES
variables (`out=`) as the document's datasets and values - it never
draws its own output. The block is its code; charts, tables and
formulas use what it publishes. Without `data=`/`out=` the fence is
inert code, exactly as on GitHub.

## Contract

- **Model**: `{ kind: "code", lang: "python", info: "data=@a,@b out=x,y" }`
  - the fence round-trips byte for byte. Either key makes it compute
  (a script may make data from nothing: `out=` alone).
- **Inputs** (`data=@takings,@slope`): each arrives as a variable of
  its name. A dataset is a `Table` - a list of row dicts, recalculated,
  in document order - with `.col("name")` (a column, as a list) and
  `.columns` (the names); a missing column is a `KeyError` naming the
  columns there are. A value arrives as itself (number, text, ISO
  date). A missing dataset, a non-identifier id, or a block reading
  its own output is an error.
- **Outputs** (`out=fit,slope`): after the script runs, each named
  variable becomes `@<name>`:
  - list of row dicts (columns in first-seen order), dict of column
    lists, pandas DataFrame -> a dataset; column types inferred
    (numbers, ISO dates, text); NaN/None -> blank;
  - number, text, bool, date/datetime -> a value;
  - not set, empty, or anything else -> an error naming it;
  - an id another table, value or chart uses -> an error.
  Names starting with `_` are never offered. `return` is an error that
  says what replaced it.
- **Snapshot** (ADR-0005): the outputs are the run of
  `computed: python` blocks right after the code block -
  `::: table {#fit}` / `::: value {#slope}` - parsed by the engine
  (`Table.computed`, `Table.value`) and rendered as hidden
  placeholders (`figure.folio-computed`) so block indexes and the
  DOM -> model sync stay aligned. A run rewrites them only when they
  changed; a change in COUNT re-renders (out= changed), otherwise the
  models are replaced in place. The write is DERIVED: saved with the
  document, folded into the current undo state, never its own step.
- **Values in formulas**: a bare `@slope` reads the value (rewritten
  to its one cell before reference checks); any path into it
  (`@slope.r1`, `@slope.col.x`) is an error saying it is a value. A
  chart over a value is an error saying a chart needs a dataset.
- **Running**: on render, 600 ms after the code is edited, and when a
  `data=` table or value changes (`refreshDependents`). After a run,
  changed outputs ripple: other tables' formulas recalculate in place
  (`rippleFormulas`, text only), and charts, models and other compute
  blocks over them redraw.
- **Status line** (`.compute-status`, under the code, not printed):
  "Computing…" while it runs; then `→ @fit (14 rows) · @slope = 8.56` -
  each dataset a button opening the dataset browser (its press stops
  at the button: the header opening under it moved it before the
  click landed) - or `Compute error: <error> (line N)`, the script's
  own line, never Pyodide's traceback.
- **Header** (the one inspector contract): the language picker, the
  **data** picker (datasets and values), and **Publish:** tick-boxes -
  every variable the last run could publish, plus any `out=` name it
  did not find; ticking writes `out=`.
- **Sandbox**: module worker; `fetch` reaches only the bundled runtime
  folder (set by the first job), and XHR, WebSocket, EventSource,
  importScripts, IndexedDB, caches, channels and nested workers are
  gone. One job at a time, fresh variables per job; a 10 s limit from
  when the script starts (not while queued or loading); a stuck job
  fails alone and the queue moves to a new worker.
- **Runtime**: Pyodide, lazy-loaded in the worker; dev serves it from
  node_modules (`vite.config.ts`, not pre-bundled), a build copies it
  to `dist/pyodide`.
- **Insert**: Ctrl+K "Insert a compute block (Python)" - bound to the
  first dataset, publishing `<id>_rows`.

## Acceptance

- Unit: `tests/engine/compute-values.test.ts` (snapshot round trip,
  values in formulas, paths into a value), `tests/compute/
  evaluate.test.ts` (binding, outputs, errors, `pythonError`).
- e2e: `tests/e2e/compute.spec.ts` - the example; values in formulas
  and in the source; code and data edits running again with their
  readers following; the dataset browser; errors; unpublishable and
  unset variables; name clashes; endless loop; no network; inert
  plain python; header binding and tick-boxes; palette starter; the
  snapshot drawing charts when Python cannot load.
- WebKitGTK: `tests/webkitgtk/compute.js`.
- Example: `demo/examples/compute.md` (Coffee forecast). First-contact
  eval: `evals/compute-first-contact.md`.
