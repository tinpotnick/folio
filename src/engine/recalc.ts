/**
 * Formula recalculation over typed tables (ADR-0003, ADR-0005).
 * Automatic and invisible: no execution affordances; editing a cell
 * updates every dependent formula. Formula columns reference other
 * columns by name.
 */
import type { Cell, Table } from "./index.js";

export type AstNode =
  | { kind: "column"; name: string }
  | { kind: "number"; value: number }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; l: AstNode; r: AstNode };

/**
 * Supported grammar (v0): column arithmetic with +, -, *, / and
 * parentheses, e.g. "(q3 - q2) / q2". Whitespace-insensitive.
 * Errors are thrown with context so agents can write precise tests.
 */
export function parseFormula(expr: string): AstNode {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = (): string | undefined => tokens[pos];
  const next = (): string | undefined => tokens[pos++];

  function parseExpr(): AstNode {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next() as "+" | "-";
      left = { kind: "bin", op, l: left, r: parseTerm() };
    }
    return left;
  }
  function parseTerm(): AstNode {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next() as "*" | "/";
      left = { kind: "bin", op, l: left, r: parseFactor() };
    }
    return left;
  }
  function parseFactor(): AstNode {
    const t = next();
    if (t === undefined) throw new Error("Unexpected end of formula");
    if (t === "(") {
      const e = parseExpr();
      if (next() !== ")") throw new Error("Expected ) in formula");
      return e;
    }
    if (/^[0-9.]+$/.test(t)) return { kind: "number", value: parseFloat(t) };
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return { kind: "column", name: t };
    throw new Error(`Unexpected token in formula: '${t}'`);
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Trailing tokens in formula");
  return result;
}

export function recalcTable(table: Table): Table {
  const formulaIndexes = table.columns
    .map((c, i) => ({ col: c, index: i }))
    .filter((x) => x.col.type === "formula");
  if (formulaIndexes.length === 0) return table;

  const rows: Cell[][] = table.rows.map((row) => row.slice());
  for (const { col, index } of formulaIndexes) {
    const ast = parseFormula(col.expr ?? "");
    table.rows.forEach((row, r) => {
      const ctx: Record<string, number> = {};
      table.columns.forEach((c, i) => {
        const cell = row[i];
        if (c.type === "number" && typeof cell === "number") {
          ctx[c.name] = cell;
        }
      });
      const src = rows[r] ?? [];
      const out: Cell[] = table.columns.map((_, i) => src[i] ?? "");
      out[index] = evalAst(ast, ctx, table.id, col.name);
      rows[r] = out;
    });
  }
  return { ...table, rows };
}

function evalAst(
  node: AstNode,
  ctx: Record<string, number>,
  tableId: string,
  colName: string,
): number {
  switch (node.kind) {
    case "column": {
      const v = ctx[node.name];
      if (v === undefined) {
        throw new Error(
          `Formula '${colName}' in table '${tableId}': unknown or non-numeric column '${node.name}'`,
        );
      }
      return v;
    }
    case "number":
      return node.value;
    case "bin": {
      const l = evalAst(node.l, ctx, tableId, colName);
      const r = evalAst(node.r, ctx, tableId, colName);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? 0 : l / r;
      }
    }
  }
}

function tokenize(expr: string): string[] {
  const out: string[] = [];
  const re = /(\s+|[0-9.]+|[A-Za-z_][A-Za-z0-9_]*|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const tok = (m[0] ?? "").trim();
    if (tok.length > 0) out.push(tok);
  }
  return out;
}
