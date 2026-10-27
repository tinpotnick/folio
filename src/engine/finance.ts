/**
 * Finance functions for formulas (docs/specs/formulas.md, "Finance").
 * Names, argument order and SIGNS follow the spreadsheets (Excel,
 * LibreOffice, Google Sheets): money you pay out is negative, money
 * you receive positive - pmt(4.5%/12, 300, 250000) is -1389.58. So a
 * formula learned in a spreadsheet works here unchanged. `type` is 0
 * for payments at the end of each period (the default), 1 for the
 * start.
 */

const n = (v: unknown, dflt = 0): number =>
  v === undefined || v === null || v === "" ? dflt : Number(v);

/** Payment per period of a loan or annuity. */
export function pmt(
  rate: unknown,
  nper: unknown,
  pv: unknown,
  fv?: unknown,
  type?: unknown,
): number {
  const r = n(rate);
  const N = n(nper);
  const P = n(pv);
  const F = n(fv);
  const t = n(type) ? 1 : 0;
  if (r === 0) return -(P + F) / N;
  const g = Math.pow(1 + r, N);
  return (-(P * g + F) * r) / ((1 + r * t) * (g - 1));
}

/** Future value after `nper` periods. */
export function fv(
  rate: unknown,
  nper: unknown,
  payment: unknown,
  pv?: unknown,
  type?: unknown,
): number {
  const r = n(rate);
  const N = n(nper);
  const M = n(payment);
  const P = n(pv);
  const t = n(type) ? 1 : 0;
  if (r === 0) return -(P + M * N);
  const g = Math.pow(1 + r, N);
  return -(P * g + (M * (1 + r * t) * (g - 1)) / r);
}

/** Present value of a series of payments. */
export function pv(
  rate: unknown,
  nper: unknown,
  payment: unknown,
  fvalue?: unknown,
  type?: unknown,
): number {
  const r = n(rate);
  const N = n(nper);
  const M = n(payment);
  const F = n(fvalue);
  const t = n(type) ? 1 : 0;
  if (r === 0) return -(F + M * N);
  const g = Math.pow(1 + r, N);
  return -(F + (M * (1 + r * t) * (g - 1)) / r) / g;
}

/** Number of periods to pay off `pv` (or reach `fv`). */
export function nper(
  rate: unknown,
  payment: unknown,
  pvalue: unknown,
  fvalue?: unknown,
  type?: unknown,
): number {
  const r = n(rate);
  const M = n(payment);
  const P = n(pvalue);
  const F = n(fvalue);
  const t = n(type) ? 1 : 0;
  if (r === 0) return -(P + F) / M;
  const k = M * (1 + r * t);
  return Math.log((k - F * r) / (k + P * r)) / Math.log(1 + r);
}

/** Interest rate per period (Newton's method from `guess`). */
export function rate(
  nperiods: unknown,
  payment: unknown,
  pvalue: unknown,
  fvalue?: unknown,
  type?: unknown,
  guess?: unknown,
): number {
  const N = n(nperiods);
  const M = n(payment);
  const P = n(pvalue);
  const F = n(fvalue);
  const t = n(type) ? 1 : 0;
  let r = n(guess, 0.1);
  const f = (x: number): number =>
    Math.abs(x) < 1e-12
      ? P + M * N + F
      : P * Math.pow(1 + x, N) +
        (M * (1 + x * t) * (Math.pow(1 + x, N) - 1)) / x +
        F;
  for (let i = 0; i < 100; i++) {
    const y = f(r);
    const h = 1e-7;
    const d = (f(r + h) - y) / h;
    if (!Number.isFinite(d) || d === 0) return Number.NaN;
    const next = r - y / d;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  return Number.NaN;
}

/** Interest part of payment number `per` (1-based). */
export function ipmt(
  rate: unknown,
  per: unknown,
  nperiods: unknown,
  pvalue: unknown,
  fvalue?: unknown,
  type?: unknown,
): number {
  const r = n(rate);
  const k = n(per);
  const t = n(type) ? 1 : 0;
  if (k < 1 || k > n(nperiods)) return Number.NaN;
  if (t === 1 && k === 1) return 0;
  const payment = pmt(r, nperiods, pvalue, fvalue, t);
  // The balance after k-1 payments, then a period's interest on it.
  const balance = fv(r, k - 1, payment, pvalue, t);
  const interest = balance * r;
  return t === 1 ? interest / (1 + r) : interest;
}

/** Principal part of payment number `per` (1-based). */
export function ppmt(
  rate: unknown,
  per: unknown,
  nperiods: unknown,
  pvalue: unknown,
  fvalue?: unknown,
  type?: unknown,
): number {
  return (
    pmt(rate, nperiods, pvalue, fvalue, type) -
    ipmt(rate, per, nperiods, pvalue, fvalue, type)
  );
}

/** Numbers from an array (a column) or a list of arguments. */
function values(args: unknown[]): number[] {
  return args
    .flatMap((a) => (Array.isArray(a) ? a : [a]))
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
}

/** Net present value of cash flows at the END of periods 1, 2, ... */
export function npv(rate: unknown, ...flows: unknown[]): number {
  const r = n(rate);
  return values(flows).reduce((s, c, i) => s + c / Math.pow(1 + r, i + 1), 0);
}

/** Internal rate of return of cash flows at periods 0, 1, 2, ... */
export function irr(flows: unknown, guess?: unknown): number {
  const c = values([flows]);
  if (!c.some((x) => x > 0) || !c.some((x) => x < 0)) return Number.NaN;
  const f = (r: number): number =>
    c.reduce((s, x, i) => s + x / Math.pow(1 + r, i), 0);
  let r = n(guess, 0.1);
  for (let i = 0; i < 200; i++) {
    const y = f(r);
    const h = 1e-7;
    const d = (f(r + h) - y) / h;
    if (!Number.isFinite(d) || d === 0) return Number.NaN;
    const next = r - y / d;
    if (Math.abs(next - r) < 1e-12) return next;
    r = next <= -1 ? (r - 1) / 2 : next;
  }
  return Number.NaN;
}

/** Compound annual growth rate from `start` to `end` over `years`. */
export function cagr(start: unknown, end: unknown, years: unknown): number {
  const a = n(start);
  const b = n(end);
  const y = n(years);
  if (a <= 0 || b < 0 || y <= 0) return Number.NaN;
  return Math.pow(b / a, 1 / y) - 1;
}
