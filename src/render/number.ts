/**
 * Display formatting for COMPUTED values (spec: docs/specs/
 * formulas.md, "Display"). A formula result is a float: printed raw
 * it reads `0.0062132653273250064`, which is noise in a report and
 * blows a table past its page. Display only - the model, formulas,
 * charts and exports keep the exact value; typed numbers show
 * exactly as typed.
 */

/** Decimal places a computed value shows at most. */
export const COMPUTED_DECIMALS = 6;

export function formatComputed(
  v: unknown,
  format?: "percent" | "currency",
): string {
  if (typeof v !== "number") return String(v ?? "");
  if (!Number.isFinite(v)) return String(v);
  if (format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (Number.isInteger(v)) return String(v);
  // A non-zero value too small for the fixed places would print as
  // "0" - a lie; it keeps three significant figures instead.
  if (Math.abs(v) < 10 ** -COMPUTED_DECIMALS) {
    return v.toExponential(2).replace(/\.?0+e/, "e");
  }
  const fixed = v.toFixed(COMPUTED_DECIMALS).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}
