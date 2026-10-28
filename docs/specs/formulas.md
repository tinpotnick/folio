# Table formula reference language

## Status: accepted (2026-10-18, revised same day)

## Decision

Formula columns evaluate Jexl (ADR-0012) against a namespaced ROW
CONTEXT. The reference language is plain Jexl plus context
objects — no folio grammar is bolted on. `self` is the current
table; other tables are referenced by id with the same `@` marker
the chart query language uses (`source: @budget`). Columns are
addressed BY NAME everywhere, never by spreadsheet coordinates.

## Reference forms

| Form | Meaning | Rules |
|---|---|---|
| `name` | Current row's value | Numeric or EARLIER formula columns only |
| `self.row` | Current row number (1-based) | Always available |
| `self.prev.name` | Previous row | ANY column, including the formula's own — the running-total form |
| `self.prev2.name` | Two rows back (`prev3`, … by distance) | ANY column; distances before row 1 read empty |
| `self.r4.name` | Row 4 of this table (1-based) | ANY column; rows past the data read empty |
| `self.col.name` | The WHOLE column as an array | Numeric or EARLIER formula columns only — feeds the aggregates and signal transforms below |
| `@budget.r3.q2` | Row 3 of the table with id `budget` (bare `budget.r3.q2` works too) | ANY column of that table, including its computed formulas |
| `@budget.prev.q2` | The LAST row of that table | A table has no current row inside another table's formula |

Jexl's own operators apply everywhere: `&&`, `||`, `!`, comparisons,
and ternaries (note: Jexl 2.x has no word-form logic operators).

- **Running totals**: `q2 + (self.row == 1 ? 0 : self.prev.total)`
  — row 1 has no previous row (`self.prev` reads NaN), hence the
  guard.
- **Recurrences**: distances compose with chaining — the Fibonacci
  form `self.row == 1 ? 1 : self.row == 2 ? 1 : self.prev.f + self.prev2.f`
  works because a formula's own column is computed top-down row by
  row.
- **Chaining**: formula columns compute left to right; a formula
  may reference formula columns to its LEFT. A later formula
  column errors ("a formula may only reference columns to its
  left"); a plain reference to the formula's own column errors
  pointing at `self.prev.name`.
- **Cross-table order**: referenced tables recalc first
  (dependency order, cycle-detected — a circular reference between
  two tables is a visible error). The `@` marker is stripped before
  evaluation (it is not a Jexl token; string literals keep theirs),
  which keeps the terminology identical to the chart `source: @id`
  form. Referenced table ids must be VALID IDENTIFIERS — a hyphen
  would lex as subtraction, so hyphenated ids are rejected with a
  clear error rather than silently mis-evaluating.
- **Errors** carry the table id and formula column name; unknown
  columns and tables are rejected by name in the message. Plain
  names are numeric-only (text columns throw); row-context
  references (`self.*`, `@table.*`) may read text columns for
  comparisons.
- Division by zero yields 0; non-finite results render empty
  (reporting contract, ADR-0012).

## Constants

`pi` (π), `tau` (2π), and `e` (Euler's number) are available in
every formula and chart filter. A column of the same name shadows
the constant. Example: `sin(2 * pi * 5 * t)`.

## Math function catalog

Every entry below is callable in two forms: the natural call
`sqrt(x)`, `hypot(re, im)`, `sin(2 * pi * f * t)` — and the pipe
`x | sqrt()`, which is how transforms apply to a whole expression
(the pipe binds tighter than arithmetic, so parenthesize its
operand: `((q3 - q2) / q2 * 100) | round(1)`). Pipes chain:
`self.col.sig | fft() | at(self.row - 1)`.

**Rounding & limits** (already shipped): `round(p)`, `floor()`,
`ceil()`, `abs()`, `clamp(lo, hi)`, `min`, `max` — `min`/`max` are
variadic over scalars (`a | min(b, c)`) and aggregate an array
(`self.col.q2 | min()`).

**Powers, roots, logs**: `sqrt()`, `cbrt()`, `pow(n)`, `exp()`,
`ln()`, `log10()`, `log2()`.

**Trigonometry** (radians unless noted): `sin()`, `cos()`, `tan()`,
`asin()`, `acos()`, `atan()`, `atan2(x)` — the piped value is the
*y*: `dy | atan2(dx)`; hyperbolic `sinh()`, `cosh()`, `tanh()`;
`deg()` converts radians→degrees, `rad()` degrees→radians.

**Number utility**: `sign()`, `mod(n)` (true modulo — the result
takes the divisor's sign, unlike JS `%`), `hypot(x)` —
`Math.hypot(piped, x)`.

**Column aggregates** — pipe a whole column (`self.col.name`) or a
scalar; empty and non-finite cells are skipped, so a sparse column
aggregates its data honestly: `sum()`, `count()`, `mean()`,
`median()`, `stdev()` (sample, n−1), `min()`, `max()`, `first()`,
`last()`, `at(i)` (0-based; out-of-range reads empty).

**Signal transforms** — the piped array is the sampled signal
(`self.col.name`); missing samples read as 0:

| Transform | Meaning |
|---|---|
| `dftRe(k)` / `dftIm(k)` | Real/imaginary part of DFT bin *k* — the textbook O(N) sum |
| `dftMag(k)` | Magnitude of DFT bin *k* |
| `dftPhase(k)` | Phase angle of bin *k*, radians |
| `fft()` | Radix-2 Cooley–Tukey FFT; returns every bin's magnitude as an array (N must be a power of two; pair with `at(k)`) |
| `sma(i, w)` | Simple moving average of window *w* ending at row index *i* (0-based, inclusive) |

Whole-column references are read ONCE per formula column, from the
recalced state — earlier formula columns are complete, later ones
are rejected with the standard "columns to its left" error, and the
formula's own column is rejected pointing at `self.prev`. Text
columns are rejected (numeric only). The canonical walkthrough
document is `demo/examples/signal-processing.md` — a 64-row
signal, its DFT/FFT spectrum, and a recursive filter, each step
computed in the table and plotted.

## Finance (2026-10-27)

Spreadsheet names, argument order and SIGNS (Excel, LibreOffice,
Google Sheets): money paid out is negative, received positive, so a
formula learned in a spreadsheet works unchanged
(`src/engine/finance.ts`). `type` 0 = payments at period end
(default), 1 = start.

| Function                                              | Meaning                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pmt(rate, nper, pv, fv?, type?)`                     | Payment per period: `pmt(4.5%/12, 300, 250000)` = −1389.58                     |
| `fv(rate, nper, pmt, pv?, type?)`                     | Future value                                                                   |
| `pv(rate, nper, pmt, fv?, type?)`                     | Present value                                                                  |
| `nper(rate, pmt, pv, fv?, type?)`                     | Periods to pay off / reach fv                                                  |
| `rate(nper, pmt, pv, fv?, type?, guess?)`             | Rate per period (Newton)                                                       |
| `ipmt(rate, per, nper, pv, fv?, type?)` / `ppmt(...)` | Interest / principal in payment `per` (1-based)                                |
| `npv(rate, flows…)`                                   | Net present value, flows at the end of periods 1, 2, … (an array or arguments) |
| `irr(flows, guess?)`                                  | Internal rate of return, flows at periods 0, 1, … (needs a sign change)        |
| `cagr(start, end, years)`                             | Compound annual growth rate                                                    |

**Unary minus** works on anything: `-pmt(…)`, `-balance`, `-(a + b)`.
Jexl 2 only has it on number literals, so `unaryMinus` rewrites `-X`
(at the start, after an operator, bracket or comma) as `(0 - X)`
before evaluation - in formulas and chart filters alike.

**Spreadsheet habits** (`spreadsheetHabits`, before the reference
scan): a leading `=` is dropped; function names in any case are
folio's (`PMT(` → `pmt(`); a percentage `4.5%` is `(4.5 / 100)` - a
`%` straight after a number with no operand after it (`10 % 3` and
`10%3` stay modulo). A name used as a function that is not one is
"unknown function 'VLOOKUP'", not "unknown column".

**A broken formula breaks its column, not its table**
(`recalcTolerant` in the component): the failing formula is blanked
and the table recalculated, so the rest renders; the broken column's
cells read `#ERR`, and the error line above the table names it -
clicking the line opens that column's inspector. (Before: the whole
table was replaced by the message, with no way back but undo.)

**Formats**: `format: currency` shows computed values with two
places and thousands separators (1,389.58), alongside `percent`;
both in the inspector's format menu ("money").

## Dates (2026-10-27)

A `date` column holds ISO `YYYY-MM-DD` text: readable in the source,
sortable, unambiguous. In formulas a date column is referenced by name
like a number column (its value is the ISO text); `self.col.d` gives
the dates as text. Functions (`src/engine/dates.ts`; spreadsheet
names) take ISO dates or anything import reads, and an unreadable date
is empty, never an error:

`date(y, m, d)` → ISO; `year(d)`, `month(d)`, `day(d)`; `edate(d, n)`
(n months on, the day clamped to the month's end, as EDATE);
`eomonth(d, n)`; `days(end, start)`; `months(start, end)` (whole
months); `yearfrac(start, end)` (actual days / 365.25). A formula
column may produce a date: `edate(start, self.row - 1)`.

## Blanks (2026-10-28)

A blank cell is NO value - never a zero:

- In a formula, a blank number or formula cell reads as NaN (the
  current row's earlier formulas, `self.prev.x`, `@t.rN.x`), so
  arithmetic on it gives a blank: `a * 2` of a blank `a` is blank, and a
  running total through a blank is blank, not "carried on" (in Jexl,
  `"" * 2` would have been 0 - a plausible wrong number). Text and date
  cells keep `""` for comparisons. A formula can make a blank on
  purpose: `n <= term ? ... : ""` - a model past its term or its data.
- The aggregates skip blanks (`sum`, `count`, `mean`, `last`, ...):
  `self.col.x | last()` is the last value, wherever the column ends.
- Charts draw a blank as a gap: a line breaks, a bar is left out, and
  no value label sits on it (chart-rendering.md).

## Lookups (2026-10-27)

- `@prices.col.close` - another table's WHOLE column (numbers stay
  numbers, dates and text stay text, so a key column can be text).
  The table recalcs first; `self.col.x` remains the own-table form.
- `xlookup(key, keys, values)` - the value beside the key equal to
  `key` (dates compare as dates, numbers as numbers); empty if none.
- `asof(key, keys, values)` - the value at the LAST key on or before
  `key`, keys ascending: the price in force on a date, from monthly
  prices. Empty before the first key. Past the last key it holds the
  last value: a model must stop at its data's end itself.
- Speed: a lookup column is read once per formula column (its keys
  parsed and indexed), then `asof` binary-searches and `xlookup` looks
  up exactly; formulas are parsed once per column, not per row. 2,000
  rows against 3,000 keys recalculates in well under a second.

## Chart filters speak the same language

A chart query's `filter` is a Jexl boolean expression over the
SOURCE table's columns, evaluated per row against the recalced
table (text columns included):

```
query: {select: [region, growth], filter: "q2 > 350 && region != 'South'"}
```

- A typo'd column is a visible error ("Filter error: unknown column
  'x'"), never a silently empty chart.
- The legacy `{column, op, value}` triple (eq/gt/lt) still parses
  and round-trips; the expression form is the documented one.
- Filters address their source table's columns only (no `self.*`
  or `@table.*` handles - charts already choose their source).
- Comma caveat: string literals inside a filter must not contain
  commas (the directive map splits on them outside double
  quotes).

## Recalculation

Editing any cell recomputes the whole table and refreshes every
formula cell in place (text-only updates, no structural re-render,
caret untouched), then refreshes every OTHER table's formula cells
that may reference it, plus dependent charts.

## Display

A formula result is a float; printed raw it reads
`0.0062132653273250064`, which is noise in a report and pushes a
table past its page. Computed cells (in the document AND the
dataset browser) DISPLAY at most six decimal places with trailing
zeros trimmed (`0.006213`, `0.5`); integers print as-is; a non-zero
value too small for six places keeps three significant figures
(`1.23e-9`), so it never shows as a false `0`; `format: percent`
keeps its one-decimal percentage. This is display only: the model,
formulas, chart queries and exports see the exact value. Typed
number cells show exactly what was typed. (`formatComputed` in
src/render/number.ts; unit tests in `tests/render/number.test.ts`.)

## Syntax note

`_prev`/`_rN` (an earlier draft of this language) were renamed to
`self.prev`/`self.rN` so the same mechanism extends across tables
by name; `@budget` is the explicit cross-table form for parity with
the chart query language.

## Acceptance

- Finance, dates, lookups, unary minus: `tests/engine/finance.test.ts`
  (spreadsheet-documented values; a 300-month repayment schedule that
  ends at zero; `asof`/`xlookup` across tables); e2e
  `tests/e2e/import-web.spec.ts` (a running mortgage balance in the
  document).

- Engine: `tests/engine/recalc.test.ts` (self.* references,
  formula history, running totals, Fibonacci, forward/empty,
  chaining allowed left / rejected right, self-reference, row 0
  and prev0, cross-table refs incl. recalced formulas and
  last-row prev, `@` parity, circular rejection, hyphen rejection,
  bare-reference hints, text via row context, unknowns).
- e2e: `tests/e2e/editor.spec.ts` (running totals render and
  recalculate on edit; `self.rN` row references; `@budget`
  cross-table render + live ripple on edit).
- Documented in `demo/help.md`; engine contract in ADR-0012.
