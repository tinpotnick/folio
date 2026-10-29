# ADR-0030: Compute blocks - Python reads and writes datasets

Date: 2026-11-20; revised 2026-10-29

Status: accepted (revised: the first draft made a block's returned
tables its figure; this one makes Python a source of data)

## Context

Formulas and charts (ADR-0012, ADR-0004) cover a lot, but regressions,
models and bespoke transforms push authors out of the document, and the
numbers come back pasted and stale. Pyodide (CPython in WebAssembly,
permissive licences, ADR-0007) runs that work inside folio, in a worker.

AGENTS.md says folio is not a notebook: no run buttons, no execution
state. The first draft rendered a block's returned tables in place of
its code; in use that read as the script drawing its own output, which
is not what the block is for. Python is a SOURCE OF DATA, like an
import - not a figure.

## Decision

1. **One namespace, one grammar.** Everything a document can point at
   is a top-level `@name`, unique in the document: tables, imported
   data, Python outputs, single values (later, a chart's plotted
   data). Dots go INTO a thing (`@fit.r3.trend`, `@fit.col.trend`),
   never into its producer. New kinds of thing become new kinds of
   `@name`, never new path levels.
2. **The block is code.** ```` ```python data=@takings out=fit,slope ````
   always renders as an editable, highlighted code block - never
   replaced by output. A plain ```` ```python ```` fence (no `data=`
   or `out=`) is inert code, exactly as on GitHub.
3. **In: `data=`.** Each named dataset arrives as a Python variable of
   the same name - a `Table`: a list of row dicts in document order
   (`takings[2]["takings"]` is a cell; Python counts from 0, formulas
   from 1, each natural to its language) with helpers that can grow
   without breaking a script (`takings.col("day")`,
   `takings.columns`). A named value arrives as itself. Declared
   inputs tell folio what to run again when a table changes, without
   running anything.
4. **Out: `out=`, explicit.** Each listed VARIABLE becomes
   `@<variable>` after the script runs: a list of row dicts, a dict of
   column lists or a pandas DataFrame becomes a **dataset** (a chart's
   `source:`, formulas, the dataset browser - like any table); a
   number, text or date becomes a **value**, read bare in formulas
   (`=@slope * 30`). Anything else is an error naming the variable. A
   variable not named in `out=` stays inside Python: scratch work
   never leaks, and a rename never silently changes the document. The
   block's header lists the variables a run could publish as
   tick-boxes, which write `out=`. Names starting with `_` are never
   published; an output id clashing with any other `@name` is an
   error. `return` is not used.
5. **No execution affordances.** Running is silent: on load, after the
   code is edited (a moment after typing pauses), and when a `data=`
   table changes. One line under the code says what it published
   (`→ @fit (14 rows) · @slope = 8.56`, each dataset opening the
   dataset browser) or the error, with the script's line. Outputs are
   not drawn on the page; charts and tables decide how they appear.
6. **Offline (ADR-0005).** The outputs are stored in the document as a
   snapshot, right after the block: a dataset as `::: table {#fit}`, a
   value as `::: value {#slope}`, each `computed: python`. They are
   not shown; they are what charts and formulas read - so the
   document renders fully with Python unloaded, offline, or in a host
   that cannot run it. A run that changes them rewrites them; that is
   part of the edit that caused it, not an undo step of its own.
7. **Sandbox.** A worker with no network, storage or DOM; the only
   fetch it keeps is the bundled runtime's own files. One script runs
   at a time, each with fresh variables, and a 10 s limit while it
   runs.
8. **Engine stays UI-free (ADR-0001).** The snapshot blocks and value
   resolution live in `src/engine/`; the binding, conversion and
   running live in `src/compute/`.

## Consequences

- A reader sees code, and the charts and tables that use its results -
  never a cell output. A report still reads as a report.
- Formulas gain one concept, the named value (`@slope`), held as a
  one-cell table so every path that resolves `@id` finds it;
  `@slope.r1` says it is a value.
- Other runtimes (R, Octave) can join under the same contract:
  datasets and values in, datasets and values out, no affordances.
- Deferred, fitting the same rules: a chart's plotted rows as an input
  (`data=@trend_chart`); more `Table` helpers (`to_pandas()` waits for
  pandas to be bundled - it would need the network); a value in prose.
