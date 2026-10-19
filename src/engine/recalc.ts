/**
 * Formula recalculation over typed tables (ADR-0003, ADR-0005,
 * ADR-0012). Automatic and invisible: no execution affordances;
 * editing a cell updates every dependent formula. Formula columns
 * reference other columns by name and are written in Jexl: column
 * arithmetic plus comparisons, logic, string operations, and the
 * transforms registered below.
 */
import jexl from "jexl";
import type { Cell, Table } from "./index.js";

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

// A small, documented transform set (called with the pipe syntax,
// e.g. "growth * 100 | round()").
jexl.addTransform("round", (v: unknown, ...args: unknown[]): number =>
  Number(Number(v).toFixed(Number(args[0] ?? 0))),
);
jexl.addTransform("floor", (v: unknown): number => Math.floor(Number(v)));
jexl.addTransform("ceil", (v: unknown): number => Math.ceil(Number(v)));
jexl.addTransform("abs", (v: unknown): number => Math.abs(Number(v)));
jexl.addTransform("min", (a: unknown, ...args: unknown[]): number =>
  Math.min(Number(a), Number(args[0])),
);
jexl.addTransform("max", (a: unknown, ...args: unknown[]): number =>
  Math.max(Number(a), Number(args[0])),
);

const TRANSFORMS = new Set(["round", "floor", "ceil", "abs", "min", "max"]);
const KEYWORDS = new Set(["true", "false", "null", "and", "or", "not", "in"]);

/**
 * Identifiers an expression references. Jexl resolves unknown
 * context keys to undefined (and then NaN), which would silently
 * blank the cell; the contract wants a visible error naming the
 * unknown or non-numeric column, so the references are validated
 * before evaluation.
 */
function referencedColumns(expr: string): string[] {
  const out = new Set<string>();
  // Scan identifiers outside string literals.
  const stripped = expr.replace(/'[^']*'|"[^"]*"/g, "");
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[0] ?? "";
    if (!KEYWORDS.has(name) && !TRANSFORMS.has(name)) out.add(name);
  }
  return Array.from(out);
}

export function recalcTable(table: Table): Table {
  const formulaIndexes = table.columns
    .map((c, i) => ({ col: c, index: i }))
    .filter((x) => x.col.type === "formula");
  if (formulaIndexes.length === 0) return table;

  const rows: Cell[][] = table.rows.map((row) => row.slice());
  for (const { col, index } of formulaIndexes) {
    const expr = col.expr ?? "";
    const numeric = new Set(
      table.columns.filter((c) => c.type === "number").map((c) => c.name),
    );
    for (const name of referencedColumns(expr)) {
      if (!numeric.has(name)) {
        throw new Error(
          `Formula '${col.name}' in table '${table.id}': unknown or non-numeric column '${name}'`,
        );
      }
    }
    table.rows.forEach((row, r) => {
      const ctx: Record<string, number> = {};
      for (const c of table.columns) {
        if (c.type !== "number") continue;
        const i = table.columns.indexOf(c);
        const cell = row[i];
        ctx[c.name] = typeof cell === "number" ? cell : Number.NaN;
      }
      const src = rows[r] ?? [];
      const out: Cell[] = table.columns.map((_, i) => src[i] ?? "");
      let result: Cell;
      try {
        const v = jexl.evalSync(expr, ctx) as Cell;
        result =
          typeof v === "number" ? (Number.isFinite(v) ? v : "") : (v ?? "");
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
  return { ...table, rows };
}
