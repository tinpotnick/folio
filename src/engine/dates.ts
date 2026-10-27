/**
 * Dates in datasets (docs/specs/formulas.md, "Dates"). A date cell is
 * an ISO `YYYY-MM-DD` string - readable in the Markdown, sortable as
 * text, and unambiguous. Import reads the common published shapes and
 * writes ISO; formulas take ISO strings (or anything `toIso` reads).
 */

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

/** A valid calendar date as ISO, or null. */
export function isoOf(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthOf(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

/**
 * Read a date in one of the shapes public data uses, as ISO:
 * `2024-03-31`, `2024-03-31T00:00:00Z`, `2024-03` (month: its first
 * day), `31 Mar 2024` / `31-Mar-2024` (Bank of England), `2024 MAR`
 * (ONS months), `Mar 2024`. Day-first or month-first numeric dates
 * (`03/04/2024`) are ambiguous and are NOT read. Null when not a date.
 */
export function toIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
  if (m) return isoOf(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) return isoOf(Number(m[1]), Number(m[2]), 1);
  m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{4})$/.exec(s);
  if (m) return isoOf(Number(m[3]), monthOf(m[2] ?? ""), Number(m[1]));
  m = /^(\d{4}) ([A-Za-z]{3,9})$/.exec(s);
  if (m) return isoOf(Number(m[1]), monthOf(m[2] ?? ""), 1);
  m = /^([A-Za-z]{3,9}) (\d{4})$/.exec(s);
  if (m) return isoOf(Number(m[2]), monthOf(m[1] ?? ""), 1);
  return null;
}

/** Days since 1970-01-01 (UTC), or NaN. */
export function dayNumber(v: unknown): number {
  const iso = toIso(v);
  if (!iso) return Number.NaN;
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

/** The parts of a date, or null. */
export function partsOf(
  v: unknown,
): { y: number; m: number; d: number } | null {
  const iso = toIso(v);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y ?? 0, m: m ?? 1, d: d ?? 1 };
}

/**
 * Months later (or earlier, negative), the day clamped to the month's
 * end - 31 Jan + 1 month is 28/29 Feb, as spreadsheets' EDATE does.
 */
export function addMonths(v: unknown, n: number, toEnd = false): string | null {
  const p = partsOf(v);
  if (!p || !Number.isFinite(n)) return null;
  const total = p.y * 12 + (p.m - 1) + Math.trunc(n);
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = daysInMonth(y, m);
  return isoOf(y, m, toEnd ? last : Math.min(p.d, last));
}

/** Whole months from `a` to `b` (negative when b is earlier). */
export function monthsBetween(a: unknown, b: unknown): number {
  const p = partsOf(a);
  const q = partsOf(b);
  if (!p || !q) return Number.NaN;
  let n = (q.y - p.y) * 12 + (q.m - p.m);
  if (n > 0 && q.d < p.d) n--;
  if (n < 0 && q.d > p.d) n++;
  return n;
}

/**
 * Whether every non-empty value is a date `toIso` reads - the import
 * test for a date column (at least one value, and not all bare
 * numbers: "2024" alone is a number column).
 */
export function looksLikeDates(values: unknown[]): boolean {
  const filled = values.filter(
    (v) => v !== "" && v !== null && v !== undefined,
  );
  return filled.length > 0 && filled.every((v) => toIso(String(v)) !== null);
}
