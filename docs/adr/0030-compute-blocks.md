# ADR-0030: Compute blocks (Python via Pyodide), bound to datasets

Date: 2026-11-20

Status: proposed

## Context

Folio's datasets, formulas and charts (ADR-0003, ADR-0012, ADR-0004)
cover a lot, but the moment a document needs regression, a model,
or any bespoke transform, the author must leave the document. The
result comes back as pasted numbers that silently go stale — the
exact problem folio exists to kill.

Several languages now run in the browser via WebAssembly. Pyodide
(CPython + numpy/pandas via WASM) is the mature one; octave-wasm
and webr exist but have smaller ecosystems and, in Octave's case, a
single maintainer. AGENTS.md says folio is "not a notebook — no
execution affordances, ever". That rule is about affordances, not
about computation: Strudel plays (ADR-0014), JSCAD renders
(ADR-0020), Vega-Lite draws (ADR-0022). All three compute, and none
of them have a run button or execution chrome — they render as
figures. This ADR resolves the compute-block question with the same
move.

ADR-0007 requires a dependency note for every new dependency.
Pyodide is Mozilla's CPython compiled to WASM (Python-2.0-compatible
Permissive licence for the core; numpy/pandas as bundled under
their own permissive licences). No copyleft risk. It is large
(~10 MB), so the lazy-load pattern is mandatory, not optional.

## Decision

A ``` ```python ``` fence with a binding header becomes a
**compute figure**:

- **Model**: the existing code block (`kind: "code"`, `lang:
  "python"`) plus binding info on the fence tag line, the JSCAD
  pattern (ADR-0020's `params=` info):
  ```` ```python data=@budget,@rates out=forecast,sensitivity ````.
  The LANGUAGE TAG
  never signals execution — a plain ```` ```python ```` fence stays
  inert, highlighted code, exactly as on GitHub, so a document can
  show a Python snippet in a tutorial and a runnable forecast
  under the same tag. `data=` binds ONE OR MORE input datasets
  (comma list, the same `@id` graph formulas and charts use);
  `out=` declares one or more output dataset ids and is required.
  Multiple inputs and outputs are phase 1, not deferred — a
  genuinely useful script (fit on the budget, sensitivity against
  the rates) wants more than one table in and more than one table
  out.
  Round-trip identity holds — the info is part of the fence tag
  line, so golden tests are unaffected until the sample document
  gains an example. Spec: docs/specs/compute-blocks.md.
- **Output is a first-class dataset**: the returned table
  (column names, types, units, rows) enters the document's id
  graph like any dataset. Charts, formulas, and other compute
  blocks can reference `#forecast`. Recalc order already exists;
  a compute node is just another dependency edge.
- **No execution affordances.** The block renders its output as a
  figure, exactly like a chart: no run button, no cell chrome, no
  execution count, no busy indicator beyond the figure's own
  skeleton. Editing an input dataset (or the code) invalidates the
  output and it recalculates — the same silent contract as table
  formulas. The inspector bar (code header, per the ONE contract in
  docs/specs/figure-inspectors.md) shows the language picker and,
  for compute blocks, the input/output wiring; nothing else.
- **Presentation first**: the figure the block renders is the
  OUTPUT (a themed table or chart), not the console. stdout/stderr
  are surfaced only inside the inspector bar, never as document
  content. PDF export (ADR-0025) prints the output figure alone.
  A document full of compute blocks still reads as a report.
- **Runtime**: Pyodide, loaded via dynamic import in a Web Worker
  only when a document contains a compute block. Documents without
  one pay nothing — the Mermaid/KaTeX/Vega pattern. The worker has
  no network access; the document's datasets are the only inputs.
- **Offline render (ADR-0005)**: the block's last rendered output
  is snapshot inline in the document (the model stores code AND
  result), so the document renders fully with the runtime
  unloaded, the network cut off, and in the headless renderer.
  A stale snapshot renders until recalc replaces it — same
  snapshot-over-live rule as external bindings (block-schema
  invariant 1).
- **Engine stays UI-free (ADR-0001)**: parsing the fence header and
  the snapshot lives in `src/engine/`; running Python lives in the
  component, like every other runtime.
- **Determinism**: a compute block must not read the clock, the
  network, or randomness without a fixed seed. The recalc guard
  treats non-deterministic output as an error surfaced in the
  inspector, not as document content.

## Consequences

- One new large lazy chunk, the largest in the app (Pyodide core;
  numpy/pandas load only when the code imports them). The web
  build's first-load budget for documents without compute blocks
  is unchanged.
- The document file gains a snapshot of each compute block's
  output. The file stays plain Markdown and diffable; the snapshot
  is a generated region, stored as a dataset block the serializer
  can round-trip byte-identically (golden tests must cover a
  sample with one compute block before this ADR moves to
  accepted).
- Escalation path exists and is bounded: other WASM runtimes
  (webr, octave-wasm) can join later as additional `lang` tags
  under the same contract. The contract — inputs are datasets,
  output is a dataset, no affordances — is the decision; Python
  is just the first runtime.
- What this is NOT: no notebook. There is no way to see execution
  state, no cell outputs interleaved with code on the page, no
  way for a reader to tell which figures were computed and which
  were typed. If that line ever blurs, this ADR has failed and
  should be revisited rather than amended.
- Launch position: "your report's forecast table is live Python,
  and the chart under it queries the Python's output — one plain
  Markdown file." This is a headline demo, and it does not
  complicate the anyone-can-read-it story: on GitHub the fence is
  just code and the snapshot is just a table.
