# Formulas

A formula column computes from other columns. The expression
language is **Jexl**: numeric columns by name, `+ - * /`,
parentheses, comparisons (`>`, `<`, `==`), logic (`&&`,
`||`, `!`), and ternaries — for example
`q3 > 400 ? "up" : "down"`, or `expr: "(q3 - q2) / q2"` with
`format: percent`. The math catalog is callable two ways: as a
function (`sqrt(x)`, `hypot(re, im)`) or with a pipe — the pipe
binds tighter than arithmetic, so parenthesize its operand:
`((q3 - q2) / q2 * 100) | round(1)`. The catalog: `round`,
`floor`, `ceil`, `abs`, `clamp`, `min`, `max`, `sqrt`, `cbrt`,
`pow`, `exp`, `ln`, `log10`, `log2`, `sin`, `cos`, `tan`,
`asin`, `acos`, `atan`, `atan2`, `sinh`, `cosh`, `tanh`, `deg`,
`rad`, `sign`, `mod`, `hypot`, and the constants `pi`, `tau`,
`e`. Whole columns pipe into the aggregates and signal
transforms (`self.col.q2 | mean()`, `self.col.sig | fft() |
at(k)`): `sum`, `count`, `mean`, `median`, `stdev`, `first`,
`last`, `at`, `dftRe`, `dftIm`, `dftMag`, `dftPhase`, `fft`,
`sma`. See the *Signals and spectra* example for a full
walkthrough.

**Money** - a mortgage or loan repayment, savings growth, investment
returns - with the spreadsheets' names, arguments and signs (money
you pay is negative): `pmt(rate, periods, loan)` is the monthly
payment - `-pmt(4.5% / 12, 25 * 12, 250000)` gives 1389.58 a month -
and `fv` (future value), `pv` (present value), `nper` (how many
payments), `rate`, `ipmt` / `ppmt` (the interest and the capital in
payment N), `npv(rate, flows…)`, `irr(self.col.flows)`, and
`cagr(start, end, years)` (compound annual growth). Typed the
spreadsheet way works too: a leading `=`, `PMT` in capitals, and
percentages (`4.5%` is 0.045). A minus sign works in front of
anything: `-pmt(…)`, `-balance`. A running balance - what is left
of a mortgage after each month - is a formula that reads its own
previous row: `(self.row == 1 ? 250000 : self.prev.balance) * (1 +
4.5% / 12) - payment`. Wrap a result in `| round(2)` for pounds and
pence.

**Dates**: a date column holds ISO dates (`2025-01-31`), and imports
write them that way. `date(y, m, d)`, `year(d)`, `month(d)`,
`day(d)`, `edate(d, n)` (n months later, as the spreadsheets'
EDATE: 31 Jan + 1 month is 28/29 Feb), `eomonth(d, n)`,
`days(end, start)`, `months(start, end)` and `yearfrac(start, end)`.
A formula can produce a date: `edate(start, self.row - 1)` numbers
a repayment schedule's months.

**Looking up another table** (VLOOKUP / XLOOKUP in a spreadsheet):
`@prices.col.close` is that table's whole column. `xlookup(key, keys,
values)` finds the value beside an exact key; `asof(date, @prices.col.date, @prices.col.close)` gives the
value on or before a date - the price in the month of each payment,
from monthly prices.

Computed cells show at most six decimal places (`0.006213`, not
`0.0062132653273250064`); the exact value is still what formulas,
charts and exports use. A table wider than the page scrolls
sideways inside the page.

Formulas may reference other rows and other tables, all through
the same namespaced references (plain Jexl context objects - rows
count from 1 like a spreadsheet's, but addressed by NAME):

- `self.row` — the current row number (1-based).
- `self.prev.q2` — the previous row's value; may read ANY column,
  including the formula's own, which is how running totals work:
  `q2 + (self.row == 1 ? 0 : self.prev.total)`.
- `self.prev2.q2`, `self.prev3.q2`, … — two rows back, three rows
  back: `q2 - self.prev2.q2`. Before the first row they read as
  empty.
- `self.r4.q2` — row 4 of this table. Rows past the data read as
  empty.
- `self.col.q2` — the WHOLE column as an array (numeric or
  earlier formula columns): `self.col.q2 | sum()`,
  `self.col.sig | dftMag(self.row - 1)`.
- `@budget.r3.q2` — row 3 of the table with id `budget` (the `@`
  matches how charts name their source; the bare form
  `budget.r3.q2` works too). `@budget.prev.q2` is that table's
  LAST row - a table has no current row inside another table's
  formula. Referenced table ids must be valid identifiers - no
  hyphens.
- Row-context references (`self.*`, `@table.*`) may read text
  columns too (comparisons); plain names are numbers or dates.

A formula may reference formula columns to its LEFT (they compute
first); referencing a later formula column is an error, and a
plain reference to its own column points you at `_prev`. Only
numeric columns are referenceable in formulas (except through
`_prev`); division by zero yields 0 rather than an error. Formulas
recalculate the moment any cell they depend on changes — including
rows they reference; formula cells are never editable by hand.
