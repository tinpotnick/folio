/**
 * Formula recalculation over typed tables (ADR-0003, ADR-0005,
 * ADR-0012). Automatic and invisible: no execution affordances;
 * editing a cell updates every dependent formula.
 *
 * The expression language is Jexl plus a row context
 * (docs/specs/formulas.md). References are namespaced so the same
 * mechanism reaches other tables:
 *
 *   q2              current row's value (numeric or earlier formula)
 *   self.row        the current row number (1-based)
 *   self.prev.q2    the previous row; self.prev2.q2 two rows back
 *   self.r4.q2      row 4 of this table (1-based)
 *   budget.r3.q2    row 3 of the table with id "budget"
 *   budget.prev.q2  the LAST row of that table (a table has no
 *                  cursor inside another table's formula)
 *
 * All handles are ordinary Jexl context objects - no grammar is
 * bolted onto Jexl. Referenced tables recalc first (dependency
 * order, cycle-detected); their ids must be valid identifiers.
 */
import jexl from "jexl";
import type { Cell, Table } from "./index.js";
import * as fin from "./finance.js";
import {
  addMonths,
  dayNumber,
  isoOf,
  monthsBetween,
  partsOf,
} from "./dates.js";

// The reporting contract predates Jexl: a division by zero is a
// blank fact, not an error - the formula yields 0 rather than
// Infinity, so documents with empty denominators keep rendering.
// Registered at Jexl's default precedence for '/' (40) - a wrong
// precedence silently regroups every expression.
jexl.addBinaryOp("/", 40, (l: unknown, r: unknown): number => {
  const a = Number(l);
  const b = Number(r);
  return b === 0 ? 0 : a / b;
});

/** The names folio registers in Jexl's function AND transform
 * pools - shared with chart filters, which whitelist the same
 * names. Populated by registerFn so the set can never drift
 * from the registrations. */
export const TRANSFORMS = new Set<string>();
/** Jexl language keywords - shared with chart filters. */
export const KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "and",
  "or",
  "not",
  "in",
]);

/** Register one catalog entry in BOTH Jexl pools (ADR-0012,
 * docs/specs/formulas.md). The FUNCTION pool gives the natural
 * call form - `sqrt(x)`, `hypot(re, im)`, `sin(2 * pi * f * t)` -
 * and the TRANSFORM pool keeps the pipe form folio documents
 * (`x | sqrt()`, `(growth * 100) | round(1)`). Same signature
 * for both: the value first. */
function registerFn(
  name: string,
  fn: (v: unknown, ...args: unknown[]) => number | number[] | string,
): void {
  jexl.addTransform(name, fn);
  jexl.addFunction(name, fn);
  TRANSFORMS.add(name);
}

registerFn("round", (v: unknown, ...args: unknown[]): number =>
  Number(Number(v).toFixed(Number(args[0] ?? 0))),
);
registerFn("floor", (v: unknown): number => Math.floor(Number(v)));
registerFn("ceil", (v: unknown): number => Math.ceil(Number(v)));
registerFn("abs", (v: unknown): number => Math.abs(Number(v)));
registerFn("clamp", (v: unknown, ...args: unknown[]): number =>
  Math.min(Math.max(Number(v), Number(args[0])), Number(args[1])),
);
// min/max are polymorphic: variadic over scalars ("a | min(b, c)")
// and aggregate an array ("self.col.q2 | min()"). Empty and
// non-finite cells are skipped - a sparse column aggregates its
// data, it does not poison it with NaN.
registerFn("min", (v: unknown, ...args: unknown[]): number =>
  Math.min(
    ...((Array.isArray(v) ? v : [v, ...args]) as unknown[])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x)),
  ),
);
registerFn("max", (v: unknown, ...args: unknown[]): number =>
  Math.max(
    ...((Array.isArray(v) ? v : [v, ...args]) as unknown[])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x)),
  ),
);

/** Named constants available in every formula and chart filter
 * (docs/specs/formulas.md). A column of the same name shadows the
 * constant - contexts are seeded with these, then the row's
 * columns overwrite them. */
export const CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  tau: 2 * Math.PI,
  e: Math.E,
};

/** Coerce a piped value into a numeric sample list: a scalar reads
 * as a one-sample signal, an array elementwise. */
const samples = (v: unknown): number[] => {
  const list = Array.isArray(v) ? v : [v];
  return list.map((x) => Number(x));
};
/** Aggregate input: missing cells are skipped, not counted. */
const finite = (v: unknown): number[] =>
  samples(v).filter((x) => Number.isFinite(x));
/** Signal input: missing samples read as 0 - the DSP convention
 * for gaps (a spectrum must not depend on sparse formatting). */
const signal = (v: unknown): number[] =>
  samples(v).map((x) => (Number.isFinite(x) ? x : 0));

// --- Powers, roots, logs ---------------------------------------------
registerFn("sqrt", (v: unknown): number => Math.sqrt(Number(v)));
registerFn("cbrt", (v: unknown): number => Math.cbrt(Number(v)));
registerFn("pow", (v: unknown, n: unknown): number =>
  Math.pow(Number(v), Number(n)),
);
registerFn("exp", (v: unknown): number => Math.exp(Number(v)));
registerFn("ln", (v: unknown): number => Math.log(Number(v)));
registerFn("log10", (v: unknown): number => Math.log10(Number(v)));
registerFn("log2", (v: unknown): number => Math.log2(Number(v)));

// --- Trigonometry (radians unless noted) ------------------------------
registerFn("sin", (v: unknown): number => Math.sin(Number(v)));
registerFn("cos", (v: unknown): number => Math.cos(Number(v)));
registerFn("tan", (v: unknown): number => Math.tan(Number(v)));
registerFn("asin", (v: unknown): number => Math.asin(Number(v)));
registerFn("acos", (v: unknown): number => Math.acos(Number(v)));
registerFn("atan", (v: unknown): number => Math.atan(Number(v)));
// The piped value is y: "dy | atan2(dx)".
registerFn("atan2", (v: unknown, x: unknown): number =>
  Math.atan2(Number(v), Number(x)),
);
registerFn("sinh", (v: unknown): number => Math.sinh(Number(v)));
registerFn("cosh", (v: unknown): number => Math.cosh(Number(v)));
registerFn("tanh", (v: unknown): number => Math.tanh(Number(v)));
registerFn("deg", (v: unknown): number => (Number(v) * 180) / Math.PI);
registerFn("rad", (v: unknown): number => (Number(v) * Math.PI) / 180);

// --- Number utility ----------------------------------------------------
registerFn("sign", (v: unknown): number => Math.sign(Number(v)));
// True modulo: the result takes the divisor's sign, unlike JS %.
registerFn("mod", (v: unknown, n: unknown): number => {
  const a = Number(v);
  const b = Number(n);
  return ((a % b) + b) % b;
});
registerFn("hypot", (v: unknown, x: unknown): number =>
  Math.hypot(Number(v), Number(x)),
);

// --- Column aggregates (self.col.name; scalars pass through) ----------
const mean = (xs: number[]): number =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
registerFn("sum", (v: unknown): number => finite(v).reduce((a, b) => a + b, 0));
registerFn("count", (v: unknown): number => finite(v).length);
registerFn("mean", (v: unknown): number => mean(finite(v)));
registerFn("median", (v: unknown): number => {
  const xs = finite(v).sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length === 0
    ? Number.NaN
    : xs.length % 2 === 1
      ? (xs[mid] ?? Number.NaN)
      : ((xs[mid - 1] ?? 0) + (xs[mid] ?? 0)) / 2;
});
// Sample standard deviation (n-1), the spreadsheet convention.
registerFn("stdev", (v: unknown): number => {
  const xs = finite(v);
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  return Math.sqrt(
    xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1),
  );
});
registerFn("first", (v: unknown): number => finite(v)[0] ?? Number.NaN);
registerFn("last", (v: unknown): number => {
  const xs = finite(v);
  return xs[xs.length - 1] ?? Number.NaN;
});
registerFn("at", (v: unknown, i: unknown): number => {
  const xs = Array.isArray(v) ? v : [v];
  const got = xs[Number(i)];
  return typeof got === "number" ? got : Number(got ?? Number.NaN);
});

// --- Signal transforms (the piped array is the signal) ----------------
// The textbook DFT, one bin at a time - O(N) per row, which keeps
// the catalog honest: a row's formula computes that row's bin.
//   X_k = sum_n x_n * e^{-i 2 pi k n / N}
const dftReOf = (xs: number[], k: number): number => {
  let re = 0;
  for (let n = 0; n < xs.length; n++) {
    re += (xs[n] ?? 0) * Math.cos((2 * Math.PI * k * n) / xs.length);
  }
  return re;
};
const dftImOf = (xs: number[], k: number): number => {
  let im = 0;
  for (let n = 0; n < xs.length; n++) {
    im -= (xs[n] ?? 0) * Math.sin((2 * Math.PI * k * n) / xs.length);
  }
  return im;
};
registerFn("dftRe", (v: unknown, k: unknown): number =>
  dftReOf(signal(v), Number(k)),
);
registerFn("dftIm", (v: unknown, k: unknown): number =>
  dftImOf(signal(v), Number(k)),
);
registerFn("dftMag", (v: unknown, k: unknown): number => {
  const xs = signal(v);
  const kk = Number(k);
  return Math.hypot(dftReOf(xs, kk), dftImOf(xs, kk));
});
registerFn("dftPhase", (v: unknown, k: unknown): number => {
  const xs = signal(v);
  const kk = Number(k);
  return Math.atan2(dftImOf(xs, kk), dftReOf(xs, kk));
});
// Radix-2 Cooley-Tukey FFT: bit-reverse permutation, then butterfly
// passes. Returns every bin's magnitude - index with "at(k)". The
// per-bin DFT above and this agree to floating-point rounding
// (the demo document shows both columns side by side).
registerFn("fft", (v: unknown): number[] => {
  const xs = signal(v);
  const n = xs.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error("fft needs a power-of-two number of samples");
  }
  const re = xs.slice();
  const im: number[] = new Array(n).fill(0);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) {
      const tr = re[i] ?? 0;
      re[i] = re[j] ?? 0;
      re[j] = tr;
      const ti = im[i] ?? 0;
      im[i] = im[j] ?? 0;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wRe = Math.cos(ang * k);
        const wIm = Math.sin(ang * k);
        const a = i + k;
        const b = a + half;
        const tr = (re[b] ?? 0) * wRe - (im[b] ?? 0) * wIm;
        const ti = (re[b] ?? 0) * wIm + (im[b] ?? 0) * wRe;
        re[b] = (re[a] ?? 0) - tr;
        im[b] = (im[a] ?? 0) - ti;
        re[a] = (re[a] ?? 0) + tr;
        im[a] = (im[a] ?? 0) + ti;
      }
    }
  }
  const out: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    out[k] = Math.hypot(re[k] ?? 0, im[k] ?? 0);
  }
  return out;
});
// Simple moving average of window w ending at 0-based row index i
// (inclusive): the average of rows max(0, i-w+1) .. i.
registerFn("sma", (v: unknown, i: unknown, w: unknown): number => {
  const xs = signal(v);
  const end = Math.floor(Number(i)) + 1;
  const win = Math.max(1, Math.floor(Number(w)));
  const slice = xs.slice(Math.max(0, end - win), Math.max(0, end));
  return mean(slice);
});

// --- Finance (spreadsheet names, arguments and signs) ------------------
registerFn("pmt", (r, a, b, c, d) => fin.pmt(r, a, b, c, d));
registerFn("fv", (r, a, b, c, d) => fin.fv(r, a, b, c, d));
registerFn("pv", (r, a, b, c, d) => fin.pv(r, a, b, c, d));
registerFn("nper", (r, a, b, c, d) => fin.nper(r, a, b, c, d));
registerFn("rate", (r, a, b, c, d, g) => fin.rate(r, a, b, c, d, g));
registerFn("ipmt", (r, a, b, c, d, e) => fin.ipmt(r, a, b, c, d, e));
registerFn("ppmt", (r, a, b, c, d, e) => fin.ppmt(r, a, b, c, d, e));
registerFn("npv", (r, ...a) => fin.npv(r, ...a));
registerFn("irr", (v, g) => fin.irr(v, g));
registerFn("cagr", (a, b, y) => fin.cagr(a, b, y));

// --- Dates (ISO YYYY-MM-DD strings; spreadsheet names) -----------------
// A date that cannot be read is empty (NaN / ""), never an error.
registerFn("date", (y, m, d) => isoOf(Number(y), Number(m), Number(d)) ?? "");
registerFn("year", (v) => partsOf(v)?.y ?? Number.NaN);
registerFn("month", (v) => partsOf(v)?.m ?? Number.NaN);
registerFn("day", (v) => partsOf(v)?.d ?? Number.NaN);
registerFn("edate", (v, k) => addMonths(v, Number(k)) ?? "");
registerFn("eomonth", (v, k) => addMonths(v, Number(k), true) ?? "");
// days(end, start), as the spreadsheets order it.
registerFn("days", (end, start) => dayNumber(end) - dayNumber(start));
registerFn("months", (start, end) => monthsBetween(start, end));
// Actual days over 365.25: the long-run average year.
registerFn(
  "yearfrac",
  (start, end) => (dayNumber(end) - dayNumber(start)) / 365.25,
);

// --- Lookups across a column (another table's, usually) ---------------
/** Order two keys: as dates when both read as dates, else as numbers. */
function keyCompare(a: unknown, b: unknown): number {
  const da = dayNumber(a);
  const db = dayNumber(b);
  if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
const asCell = (v: unknown): number | string =>
  typeof v === "number" || typeof v === "string" ? v : Number.NaN;
// xlookup(key, keys, values): the value beside the matching key.
registerFn("xlookup", (key, keys, vals) => {
  const i = asList(keys).findIndex((k) => keyCompare(k, key) === 0);
  return i < 0 ? Number.NaN : asCell(asList(vals)[i]);
});
// asof(key, keys, values): the value at the last key on or before
// `key` (keys ascending) - the price on a date, from monthly prices.
registerFn("asof", (key, keys, vals) => {
  const ks = asList(keys);
  let hit = -1;
  for (let i = 0; i < ks.length; i++) {
    if (ks[i] === "" || ks[i] === undefined) continue;
    if (keyCompare(ks[i], key) <= 0) hit = i;
    else break;
  }
  return hit < 0 ? Number.NaN : asCell(asList(vals)[hit]);
});

/** Other tables of the same document, by id (raw, not recalced). */
export type TablePool = (id: string) => Table | undefined;

type RefKind =
  | { kind: "number" }
  | { kind: "date" }
  | { kind: "formula-earlier" }
  | { kind: "formula-self" }
  | { kind: "formula-later" }
  | { kind: "text" }
  | { kind: "unknown" };

type RowHandle =
  { kind: "distance"; n: number } | { kind: "absolute"; n: number };

interface SelfRef {
  handle: RowHandle;
  name: string | null; // null only for a bare handle (error, except row)
}

/** A whole-column reference - `self.col.name` - feeding the
 * aggregate and signal transforms an array of the column's
 * values (numeric or earlier formula columns only). */
interface ColRef {
  name: string;
}

interface CrossRef {
  tableId: string;
  handle: RowHandle;
  name: string;
}

function parseHandle(raw: string): RowHandle | null {
  if (raw === "prev") return { kind: "distance", n: 1 };
  if (/^prev\d+$/.test(raw)) {
    return { kind: "distance", n: Number(raw.slice("prev".length)) };
  }
  if (/^r[0-9]+$/.test(raw)) {
    return { kind: "absolute", n: Number(raw.slice(1)) };
  }
  return null;
}

/**
 * Strip the folio reference marker: "@budget" reads as "budget".
 * `@` is not a Jexl token, so this is a pure token rename with no
 * disambiguation rules - but quoted strings keep their `@` intact.
 * Cross-table terminology stays identical to the chart query
 * language's `source: @budget`.
 */
function stripAtRefs(expr: string): string {
  const parts: string[] = [];
  const re = /'[^']*'|"[^"]*"|@/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    if (m[0] !== "@") continue;
    parts.push(expr.slice(last, m.index));
    last = m.index + 1;
  }
  parts.push(expr.slice(last));
  return parts.join("");
}

/**
 * Unary minus on anything but a number literal - `-pmt(r, n, pv)`,
 * `-balance`, `-(a + b)` - which Jexl 2 cannot parse, rewritten as
 * `(0 - X)`. A minus is unary at the start or after an operator, an
 * opening bracket or a comma; X is the operand that follows (a name
 * chain with any calls or brackets, or a bracketed group).
 */
export function unaryMinus(expr: string): string {
  const isOpen = (c: string): boolean => /[([{,?:+\-*/%<>=!&]/.test(c);
  const close = (s: string, i: number): number => {
    const open = s[i];
    const shut = open === "(" ? ")" : open === "[" ? "]" : "}";
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (c === "'" || c === '"') {
        j = s.indexOf(c, j + 1);
        if (j < 0) return s.length;
        continue;
      }
      if (c === open) depth++;
      else if (c === shut && --depth === 0) return j + 1;
    }
    return s.length;
  };
  let out = expr;
  for (let guard = 0; guard < 100; guard++) {
    let changed = false;
    let prev = "";
    for (let i = 0; i < out.length; i++) {
      const c = out[i] ?? "";
      if (c === "'" || c === '"') {
        const end = out.indexOf(c, i + 1);
        i = end < 0 ? out.length : end;
        prev = c;
        continue;
      }
      if (/\s/.test(c)) continue;
      if (c === "-" && (prev === "" || isOpen(prev))) {
        let j = i + 1;
        while (/\s/.test(out[j] ?? "")) j++;
        const start = j;
        if (/[A-Za-z_@]/.test(out[j] ?? "")) {
          while (/[\w@.]/.test(out[j] ?? "")) j++;
          while (out[j] === "(" || out[j] === "[") {
            j = close(out, j);
            while (/[\w.]/.test(out[j] ?? "")) j++;
          }
        } else if (out[j] === "(") {
          j = close(out, j);
        } else {
          prev = c;
          continue; // a number literal: Jexl reads -3 itself
        }
        out = `${out.slice(0, i)}(0 - ${out.slice(start, j)})${out.slice(j)}`;
        changed = true;
        break;
      }
      prev = c;
    }
    if (!changed) break;
  }
  return out;
}

export function recalcTable(table: Table, pool?: TablePool): Table {
  return recalcWithin(
    table,
    pool ?? ((): Table | undefined => undefined),
    new Map(),
    new Set(),
  );
}

function recalcWithin(
  table: Table,
  pool: TablePool,
  cache: Map<string, Table>,
  visiting: Set<string>,
): Table {
  const cached = cache.get(table.id);
  if (cached !== undefined) return cached;
  if (visiting.has(table.id)) {
    throw new Error(
      `circular table reference: '${table.id}' is already being computed`,
    );
  }
  visiting.add(table.id);
  try {
    return compute(table, pool, cache, visiting);
  } finally {
    visiting.delete(table.id);
  }
}

function compute(
  table: Table,
  pool: TablePool,
  cache: Map<string, Table>,
  visiting: Set<string>,
): Table {
  const formulaIndexes = table.columns
    .map((c, i) => ({ col: c, index: i }))
    .filter((x) => x.col.type === "formula");
  if (formulaIndexes.length === 0) {
    cache.set(table.id, table);
    return table;
  }

  const indexByName = new Map(
    table.columns.map((c, i) => [c.name, i] as const),
  );
  const kindOf = (name: string, own: number): RefKind => {
    const i = indexByName.get(name);
    if (i === undefined) return { kind: "unknown" };
    const c = table.columns[i];
    if (c === undefined) return { kind: "unknown" };
    if (c.type === "number") return { kind: "number" };
    if (c.type === "date") return { kind: "date" };
    if (c.type !== "formula") return { kind: "text" };
    if (i < own) return { kind: "formula-earlier" };
    if (i === own) return { kind: "formula-self" };
    return { kind: "formula-later" };
  };

  const rows: Cell[][] = table.rows.map((row) => row.slice());
  for (const { col, index } of formulaIndexes) {
    const raw = col.expr ?? "";
    const fail = (msg: string): never => {
      throw new Error(`Formula '${col.name}' in table '${table.id}': ${msg}`);
    };

    // Static reference scan. Dotted chains (self.prev.q2,
    // budget.r3.q2) are row/table context accesses, not
    // current-row names: pull them out and neutralize them so the
    // plain-identifier scan stays honest. A hyphen in the head can
    // only be a table id (columns never contain dots or hyphens).
    const stripped = raw.replace(/'[^']*'|"[^"]*"/g, "");
    const selfRefs: SelfRef[] = [];
    const crossRefs: CrossRef[] = [];
    const colRefs: ColRef[] = [];
    const crossCols: { tableId: string; name: string }[] = [];
    let selfRow = false;
    const neutralized = stripped.replace(
      /@?[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g,
      (chain: string): string => {
        const [rawHead, ...segs] = chain.split(".");
        const head =
          rawHead !== undefined && rawHead.startsWith("@")
            ? rawHead.slice(1)
            : rawHead;
        if (head === undefined) return chain;
        if (head === "self") {
          if (segs.length === 1 && segs[0] === "row") {
            selfRow = true;
            return "_row__REF__";
          }
          if (segs.length === 2 && segs[0] === "col") {
            colRefs.push({ name: segs[1] ?? "" });
            return "_row__REF__";
          }
          if (segs.length !== 2) {
            fail(
              `self references are self.prev.q2, self.prevN.q2, self.r4.q2, self.col.q2, self.row`,
            );
          }
          const handle = parseHandle(segs[0] ?? "");
          if (handle === null) {
            throw new Error(
              `Formula '${col.name}' in table '${table.id}': unknown self handle '${segs[0]}'`,
            );
          }
          selfRefs.push({ handle, name: segs[1] ?? null });
          return "_row__REF__";
        }
        // A table reference (possibly this table's own id).
        if (segs.length !== 2) {
          if (pool(head) !== undefined || head === table.id) {
            fail(
              `table reference '${head}' needs a row handle and a column: ${head}.r4.q2 (${head}.prev.q2 is its last row)`,
            );
          }
          if (indexByName.has(head)) {
            fail(`column '${head}' has no properties`);
          }
          return chain;
        }
        // @prices.col.close: another table's whole column (lookups).
        if (segs[0] === "col") {
          crossCols.push({ tableId: head, name: segs[1] ?? "" });
          return "_row__REF__";
        }
        const handle = parseHandle(segs[0] ?? "");
        if (handle === null) {
          throw new Error(
            `Formula '${col.name}' in table '${table.id}': table reference '${head}' handles are prev (last row), rN (row N) or col (the whole column), not '${segs[0]}'`,
          );
        }
        crossRefs.push({ tableId: head, handle, name: segs[1] ?? "" });
        return "_row__REF__";
      },
    );
    const plain = new Set<string>();
    for (const m of neutralized.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) {
      const name = m[0];
      if (name === "_row__REF__") continue;
      if (KEYWORDS.has(name) || TRANSFORMS.has(name)) continue;
      plain.add(name);
    }
    // A bare "@table" (no row handle and column) - the chain scan
    // above only consumed dotted chains.
    for (const m of neutralized.matchAll(/@[A-Za-z_][A-Za-z0-9_-]*/g)) {
      const id = (m[0] ?? "").slice(1);
      if (pool(id) !== undefined || id === table.id) {
        fail(
          `table reference '@${id}' needs a row handle and a column: @${id}.r4.q2 (@${id}.prev.q2 is its last row)`,
        );
      }
      fail(`unknown table '@${id}'`);
    }

    for (const name of plain) {
      if (name === "self") {
        fail("self needs a handle: self.prev.q2, self.r4.q2, self.row");
      }
      if (name === "col") {
        fail("col follows self: self.col.q2");
      }
      if (name in CONSTANTS) continue;
      const kind = kindOf(name, index);
      if (kind.kind === "unknown") {
        if (name !== table.id && pool(name) !== undefined) {
          fail(
            `table reference '${name}' needs a row handle and a column: ${name}.r4.q2`,
          );
        }
        fail(`unknown column '${name}'`);
      }
      if (kind.kind === "text") fail(`non-numeric column '${name}'`);
      if (kind.kind === "formula-later") {
        fail(
          `later formula column '${name}' - a formula may only reference columns to its left`,
        );
      }
      if (kind.kind === "formula-self") {
        fail(
          `self-reference '${name}' - use self.prev.${name} for the previous row's value`,
        );
      }
    }
    for (const ref of selfRefs) {
      const handle = ref.handle;
      if (ref.name !== null) {
        const kind = kindOf(ref.name, index);
        if (kind.kind === "unknown") fail(`unknown column '${ref.name}'`);
        if (handle.kind === "distance" && handle.n < 1) {
          fail("row offsets start at 1 (self.prev = 1 row back)");
        }
        if (handle.kind === "absolute" && handle.n < 1) {
          fail("row indexes start at 1");
        }
      }
    }
    for (const ref of colRefs) {
      const kind = kindOf(ref.name, index);
      if (kind.kind === "unknown") {
        fail(`unknown column '${ref.name}'`);
      }
      if (kind.kind === "text") {
        fail(`non-numeric column '${ref.name}'`);
      }
      if (kind.kind === "formula-later") {
        fail(
          `later formula column '${ref.name}' - a formula may only reference columns to its left`,
        );
      }
      if (kind.kind === "formula-self") {
        fail(
          `self-reference '${ref.name}' - a whole-column reference reads the column being computed; use self.prev.${ref.name}`,
        );
      }
    }
    for (const ref of crossRefs) {
      const failTable = (msg: string): never =>
        fail(`table reference '${ref.tableId}': ${msg}`);
      const other = ref.tableId === table.id ? table : pool(ref.tableId);
      if (other === undefined) failTable("unknown table");
      if (/-/.test(ref.tableId)) {
        failTable(
          "referenced table ids must be valid identifiers - no hyphens",
        );
      }
      const target = other as Table;
      if (!target.columns.some((c) => c.name === ref.name)) {
        failTable(`unknown column '${ref.name}'`);
      }
      if (ref.handle.kind === "distance" && ref.handle.n !== 1) {
        failTable("cross-table prev is the LAST row; use rN for a row");
      }
      if (ref.handle.kind === "absolute" && ref.handle.n < 1) {
        failTable("row indexes start at 1");
      }
    }

    for (const ref of crossCols) {
      const other = ref.tableId === table.id ? table : pool(ref.tableId);
      if (other === undefined) {
        fail(`table reference '${ref.tableId}': unknown table`);
      }
      if (/-/.test(ref.tableId)) {
        fail(
          `table reference '${ref.tableId}': referenced table ids must be valid identifiers - no hyphens`,
        );
      }
      if (ref.tableId === table.id) {
        fail(`use self.col.${ref.name} for this table's own column`);
      }
      if (!(other as Table).columns.some((c) => c.name === ref.name)) {
        fail(`table reference '${ref.tableId}': unknown column '${ref.name}'`);
      }
    }

    // Referenced tables recalc first (dependency order); the cache
    // makes each table compute once, and the visiting set turns
    // reference cycles into visible errors.
    const crossTables = new Map<string, Table>();
    for (const ref of [...crossRefs, ...crossCols]) {
      if (crossTables.has(ref.tableId)) continue;
      if (ref.tableId === table.id) {
        crossTables.set(ref.tableId, { ...table, rows });
        continue;
      }
      const other = pool(ref.tableId);
      if (other === undefined) {
        throw new Error(
          `Formula '${col.name}' in table '${table.id}': table reference '${ref.tableId}': unknown table`,
        );
      }
      crossTables.set(ref.tableId, recalcWithin(other, pool, cache, visiting));
    }

    const snapshot = (
      row: number,
      map: Map<string, number>,
      columns: Table["columns"],
      srcRows: Cell[][],
      ownIndex: number,
      currentRow: number,
    ): Record<string, unknown> => {
      const snap: Record<string, unknown> = {};
      for (const [name, i] of map) {
        const c = columns[i];
        if (c === undefined) continue;
        // The formula's OWN column is only computed for rows above
        // the current one; forward self-references read empty.
        if (c.type === "formula" && i === ownIndex && row >= currentRow) {
          snap[name] = Number.NaN;
          continue;
        }
        const v = srcRows[row]?.[i];
        snap[name] = v === undefined ? Number.NaN : v;
      }
      return snap;
    };

    // Whole-column snapshots are taken ONCE per formula column -
    // earlier columns are complete, and the row loop never changes
    // them. Missing cells read NaN, which the aggregate transforms
    // skip and the signal transforms read as 0.
    const colSnap: Record<string, unknown> = {};
    for (const ref of colRefs) {
      const i = indexByName.get(ref.name) ?? -1;
      const isDate = table.columns[i]?.type === "date";
      colSnap[ref.name] = rows.map((row) => {
        const v = row?.[i];
        if (isDate) return typeof v === "string" ? v : "";
        return typeof v === "number" ? v : Number.NaN;
      });
    }

    // Other tables' whole columns, read once: numbers stay numbers,
    // dates and text stay text (lookup keys).
    const crossColSnap = new Map<string, Record<string, unknown[]>>();
    for (const ref of crossCols) {
      const target = crossTables.get(ref.tableId);
      if (target === undefined) continue;
      const i = target.columns.findIndex((c) => c.name === ref.name);
      const cols = crossColSnap.get(ref.tableId) ?? {};
      cols[ref.name] = target.rows.map((row) => {
        const v = row[i];
        return v === undefined || v === "" ? Number.NaN : v;
      });
      crossColSnap.set(ref.tableId, cols);
    }

    const source = unaryMinus(stripAtRefs(raw));
    table.rows.forEach((_row, r) => {
      // Constants first, so a column of the same name shadows them.
      const ctx: Record<string, unknown> = { ...CONSTANTS };
      for (const [name, i] of indexByName) {
        const c = table.columns[i];
        if (c === undefined) continue;
        if (c.type === "number") {
          const v = rows[r]?.[i];
          ctx[name] = typeof v === "number" ? v : Number.NaN;
        } else if (c.type === "date") {
          // Dates are their ISO text; the date functions read them.
          const v = rows[r]?.[i];
          ctx[name] = typeof v === "string" ? v : "";
        } else if (c.type === "formula" && i < index) {
          // Earlier formula columns: computed-so-far at this row.
          const v = rows[r]?.[i];
          ctx[name] = v === undefined ? Number.NaN : v;
        }
      }
      const self: Record<string, unknown> = {};
      if (selfRow) self.row = r + 1;
      if (colRefs.length > 0) self.col = colSnap;
      const selfSnap = (row: number): Record<string, unknown> =>
        snapshot(row, indexByName, table.columns, rows, index, r);
      for (const ref of selfRefs) {
        const key =
          ref.handle.kind === "distance"
            ? ref.handle.n === 1
              ? "prev"
              : `prev${String(ref.handle.n)}`
            : `r${String(ref.handle.n)}`;
        const row =
          ref.handle.kind === "distance" ? r - ref.handle.n : ref.handle.n - 1;
        // Out-of-range reads are NaN snapshots: empty, never an
        // engine error.
        self[key] = selfSnap(row);
      }
      ctx.self = self;
      for (const ref of crossRefs) {
        const target = crossTables.get(ref.tableId);
        if (target === undefined) continue;
        const tMap = new Map(
          target.columns.map((c, i) => [c.name, i] as const),
        );
        const tSnap = (row: number): Record<string, unknown> =>
          snapshot(row, tMap, target.columns, target.rows, -1, -1);
        const entry = (ctx[ref.tableId] ?? {}) as Record<string, unknown>;
        if (ref.handle.kind === "distance") {
          entry.prev = tSnap(target.rows.length - 1);
        } else {
          entry[`r${String(ref.handle.n)}`] = tSnap(ref.handle.n - 1);
        }
        ctx[ref.tableId] = entry;
      }

      for (const [id, cols] of crossColSnap) {
        const entry = (ctx[id] ?? {}) as Record<string, unknown>;
        entry.col = cols;
        ctx[id] = entry;
      }

      const src = rows[r] ?? [];
      const out: Cell[] = table.columns.map((_, i) => src[i] ?? "");
      let result: Cell;
      try {
        const v = jexl.evalSync(source, ctx) as Cell;
        result =
          typeof v === "number"
            ? Number.isFinite(v)
              ? v
              : ""
            : // fft() alone yields an array - it is meant to be
              // indexed with at(); a bare array is not a cell.
              Array.isArray(v)
              ? ""
              : (v ?? "");
      } catch (e) {
        throw new Error(
          `Formula '${col.name}' in table '${table.id}': ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      out[index] = result;
      rows[r] = out;
    });
  }
  const result = { ...table, rows };
  cache.set(table.id, result);
  return result;
}
