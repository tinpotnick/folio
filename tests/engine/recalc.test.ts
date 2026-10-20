import { describe, expect, it } from "vitest";
import { recalcTable, type TablePool } from "@folio/engine/recalc";
import type { Table } from "@folio/engine";

function sampleTable(): Table {
  return {
    id: "regional-data",
    columns: [
      { name: "region", type: "text" },
      { name: "q2", type: "number", unit: "£k" },
      { name: "q3", type: "number", unit: "£k" },
      {
        name: "growth",
        type: "formula",
        expr: "(q3 - q2) / q2",
        format: "percent",
      },
    ],
    rows: [
      ["North", 412, 501],
      ["South", 388, 394],
      ["Midlands", 301, 355],
    ],
  };
}

function poolOf(...tables: Table[]): TablePool {
  return (id: string): Table | undefined => tables.find((t) => t.id === id);
}

describe("recalcTable", () => {
  it("fills formula cells for every row (sample document values)", () => {
    const out = recalcTable(sampleTable());
    const expected = [(501 - 412) / 412, (394 - 388) / 388, (355 - 301) / 301];
    out.rows.forEach((row, i) => {
      expect(row[3]).toBeCloseTo(expected[i] ?? Number.NaN, 10);
    });
  });

  it("does not mutate the input table", () => {
    const t = sampleTable();
    const before = JSON.stringify(t.rows);
    recalcTable(t);
    expect(JSON.stringify(t.rows)).toBe(before);
  });

  it("returns the same object identity when no formula columns", () => {
    const t: Table = {
      id: "t",
      columns: [{ name: "a", type: "text" }],
      rows: [["x"]],
    };
    expect(recalcTable(t)).toBe(t);
  });

  it("yields empty string for formula cells when inputs are incomplete", () => {
    const t: Table = {
      id: "partial",
      columns: [
        { name: "region", type: "text" },
        { name: "q2", type: "number" },
        { name: "q3", type: "number" },
        { name: "growth", type: "formula", expr: "(q3 - q2) / q2" },
      ],
      rows: [
        ["", "", ""],
        ["South", 388, 394],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[3]).toBe("");
    expect(out.rows[1]?.[3]).toBeCloseTo((394 - 388) / 388, 10);
  });

  it("throws on unknown column reference", () => {
    const t: Table = {
      id: "bad",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "missing * 2" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/unknown column 'missing'/);
  });

  it("chained formulas work when the referenced formula column is earlier", () => {
    const t: Table = {
      id: "chain",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "b + 1" },
      ],
      rows: [[2]],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[1]).toBe(4);
    expect(out.rows[0]?.[2]).toBe(5);
  });

  it("rejects formulas referencing a LATER formula column", () => {
    const t: Table = {
      id: "later",
      columns: [
        { name: "a", type: "number" },
        { name: "x", type: "formula", expr: "y + 1" },
        { name: "y", type: "formula", expr: "a" },
      ],
      rows: [[2]],
    };
    expect(() => recalcTable(t)).toThrow(
      /later formula column 'y' - a formula may only reference columns to its left/,
    );
  });

  it("rejects plain self-reference and points at self.prev", () => {
    const t: Table = {
      id: "self",
      columns: [
        { name: "a", type: "number" },
        { name: "t", type: "formula", expr: "a + t" },
      ],
      rows: [[1], [2]],
    };
    expect(() => recalcTable(t)).toThrow(
      /self-reference 't' - use self\.prev\.t/,
    );
  });

  it("row references address any row by name (self.r2.q2)", () => {
    const t: Table = {
      id: "refs",
      columns: [
        { name: "q2", type: "number" },
        { name: "delta", type: "formula", expr: "self.r2.q2 - q2" },
      ],
      rows: [[10], [20], [30]],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[1])).toEqual([10, 0, -10]);
  });

  it("row references may address an earlier formula column's history", () => {
    const t: Table = {
      id: "refsf",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "self.r1.b + b" },
      ],
      rows: [[1], [2], [3]],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual([4, 6, 8]);
  });

  it("running totals via self.prev and self.row", () => {
    const t: Table = {
      id: "running",
      columns: [
        { name: "month", type: "text" },
        { name: "q2", type: "number" },
        {
          name: "total",
          type: "formula",
          expr: "q2 + (self.row == 1 ? 0 : self.prev.total)",
        },
      ],
      rows: [
        ["jan", 10],
        ["feb", 20],
        ["mar", 30],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual([10, 30, 60]);
  });

  it("self.prev2 reads two rows back; before the first row it reads empty", () => {
    const t: Table = {
      id: "twoback",
      columns: [
        { name: "month", type: "text" },
        { name: "q2", type: "number" },
        { name: "delta2", type: "formula", expr: "q2 - self.prev2.q2" },
      ],
      rows: [
        ["jan", 10],
        ["feb", 20],
        ["mar", 35],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual(["", "", 25]);
  });

  it("a recurrence over two rows back (Fibonacci)", () => {
    const t: Table = {
      id: "fib",
      columns: [
        {
          name: "f",
          type: "formula",
          expr: "self.row == 1 ? 1 : self.row == 2 ? 1 : self.prev.f + self.prev2.f",
        },
      ],
      rows: [[], [], [], [], []],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[0])).toEqual([1, 1, 2, 3, 5]);
  });

  it("references to the OWN column's not-yet-computed rows read empty", () => {
    const t: Table = {
      id: "forward",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "self.r3.b + a" },
      ],
      rows: [[1], [2], [3]],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual([7, 8, 9]);
  });

  it("rejects self.r0 (row indexes start at 1)", () => {
    const t: Table = {
      id: "zero",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "self.r0.a" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/row indexes start at 1/);
  });

  it("rejects self.prev0 (row offsets start at 1)", () => {
    const t: Table = {
      id: "zero",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "self.prev0.a" },
      ],
      rows: [[1], [2]],
    };
    expect(() => recalcTable(t)).toThrow(/row offsets start at 1/);
  });

  it("rejects text columns as plain formula references", () => {
    const t: Table = {
      id: "bad",
      columns: [
        { name: "name", type: "text" },
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a * 2 + name" },
      ],
      rows: [["x", 1]],
    };
    expect(() => recalcTable(t)).toThrow(/non-numeric column 'name'/);
  });

  it("row-context references may read text columns (comparisons)", () => {
    const t: Table = {
      id: "rowtext",
      columns: [
        { name: "name", type: "text" },
        {
          name: "repeat",
          type: "formula",
          expr: 'self.prev.name == "a" ? 1 : 0',
        },
      ],
      rows: [["a"], ["a"], ["b"]],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[1])).toEqual([0, 1, 1]);
  });

  it("cross-table references read another table's rows by id", () => {
    const budget: Table = {
      id: "budget",
      columns: [
        { name: "target", type: "number" },
        { name: "twice", type: "formula", expr: "target * 2" },
      ],
      rows: [[100], [200], [300]],
    };
    const actual: Table = {
      id: "actuals",
      columns: [
        { name: "q2", type: "number" },
        {
          name: "vs_budget",
          type: "formula",
          expr: "q2 - budget.r2.target",
        },
      ],
      rows: [[90], [210]],
    };
    const out = recalcTable(actual, poolOf(budget, actual));
    expect(out.rows.map((r) => r[1])).toEqual([-110, 10]);
  });

  it("cross-table prev reads the OTHER table's last row (incl. its formulas)", () => {
    const budget: Table = {
      id: "budget",
      columns: [
        { name: "target", type: "number" },
        { name: "twice", type: "formula", expr: "target * 2" },
      ],
      rows: [[100], [50]],
    };
    const actual: Table = {
      id: "actuals",
      columns: [
        { name: "q2", type: "number" },
        {
          name: "vs_last",
          type: "formula",
          expr: "q2 - budget.prev.twice",
        },
      ],
      rows: [[90]],
    };
    const out = recalcTable(actual, poolOf(budget, actual));
    // budget.prev = budget's LAST row; its formula computed (100).
    expect(out.rows[0]?.[1]).toBe(-10);
  });

  it("the @ marker reads the same as the bare table name (chart parity)", () => {
    const budget: Table = {
      id: "budget",
      columns: [{ name: "target", type: "number" }],
      rows: [[100], [200]],
    };
    const actual: Table = {
      id: "actuals",
      columns: [
        { name: "q2", type: "number" },
        {
          name: "vs_budget",
          type: "formula",
          expr: "q2 - @budget.r2.target",
        },
      ],
      rows: [[90], [210]],
    };
    const out = recalcTable(actual, poolOf(budget, actual));
    expect(out.rows.map((r) => r[1])).toEqual([-110, 10]);
  });

  it("cross-table references see the referenced table's RECALCED formulas", () => {
    const budget: Table = {
      id: "budget",
      columns: [
        { name: "target", type: "number" },
        { name: "twice", type: "formula", expr: "target * 2" },
      ],
      rows: [[100], [50]],
    };
    const actual: Table = {
      id: "actuals",
      columns: [
        { name: "q2", type: "number" },
        {
          name: "vs_budget",
          type: "formula",
          expr: "q2 - @budget.r1.twice",
        },
      ],
      rows: [[190]],
    };
    const out = recalcTable(actual, poolOf(budget, actual));
    expect(out.rows[0]?.[1]).toBe(-10);
  });

  it("rejects circular table references", () => {
    const a: Table = {
      id: "a",
      columns: [
        { name: "x", type: "number" },
        { name: "f", type: "formula", expr: "b.r1.x" },
      ],
      rows: [[1]],
    };
    const b: Table = {
      id: "b",
      columns: [
        { name: "x", type: "number" },
        { name: "f", type: "formula", expr: "a.r1.x" },
      ],
      rows: [[2]],
    };
    expect(() => recalcTable(a, poolOf(a, b))).toThrow(/circular/);
  });

  it("rejects references to hyphenated table ids with a clear error", () => {
    const hyph: Table = {
      id: "regional-data",
      columns: [{ name: "x", type: "number" }],
      rows: [[1]],
    };
    const t: Table = {
      id: "user",
      columns: [
        { name: "a", type: "number" },
        {
          name: "f",
          type: "formula",
          expr: "regional-data.r1.x",
        },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t, poolOf(hyph, t))).toThrow(
      /referenced table ids must be valid identifiers - no hyphens/,
    );
  });

  it("rejects a bare table reference missing its row and column", () => {
    const budget: Table = {
      id: "budget",
      columns: [{ name: "target", type: "number" }],
      rows: [[100]],
    };
    const t: Table = {
      id: "actuals",
      columns: [
        { name: "q2", type: "number" },
        { name: "f", type: "formula", expr: "q2 + budget" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t, poolOf(budget, t))).toThrow(
      /table reference 'budget' needs a row handle and a column/,
    );
  });

  it("rejects a bare self without a handle", () => {
    const t: Table = {
      id: "t",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a + self" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/self needs a handle/);
  });

  it("rejects unknown tables and unknown cross-table columns", () => {
    const t: Table = {
      id: "t",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "@nope.r1.x" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(
      /table reference 'nope': unknown table/,
    );
    const t2: Table = {
      id: "t",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "@nope.r1.x" },
      ],
      rows: [[1]],
    };
    const budget: Table = {
      id: "nope",
      columns: [{ name: "target", type: "number" }],
      rows: [[100]],
    };
    expect(() => recalcTable(t2, poolOf(budget, t2))).toThrow(
      /unknown column 'x'/,
    );
  });

  it("treats division by zero as 0, not an error (reporting contract)", () => {
    const t: Table = {
      id: "div",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "number" },
        { name: "f", type: "formula", expr: "a / b" },
      ],
      rows: [[1, 0]],
    };
    expect(recalcTable(t).rows[0]?.[2]).toBe(0);
  });

  it("supports Jexl comparisons and ternaries in formulas", () => {
    const t: Table = {
      id: "jexl",
      columns: [
        { name: "q3", type: "number" },
        { name: "trend", type: "formula", expr: 'q3 > 400 ? "up" : "down"' },
      ],
      rows: [[501], [394]],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[1]).toBe("up");
    expect(out.rows[1]?.[1]).toBe("down");
  });

  it("supports transforms", () => {
    const t: Table = {
      id: "jexl2",
      columns: [
        { name: "q2", type: "number" },
        { name: "q3", type: "number" },
        {
          name: "r",
          type: "formula",
          expr: "((q3 - q2) / q2 * 100) | round(1)",
        },
      ],
      rows: [[301, 355]],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[2]).toBe(17.9);
  });

  it("wraps syntax errors with the table and column context", () => {
    const t: Table = {
      id: "syn",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a +" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/Formula 'f' in table 'syn'/);
  });

  it("ternaries with spaces around the colon are not affected by @ stripping", () => {
    const t: Table = {
      id: "ternary",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a > 1 ? 10 : 5" },
      ],
      rows: [[2]],
    };
    expect(recalcTable(t).rows[0]?.[1]).toBe(10);
  });

  it("keeps @ characters inside string literals intact", () => {
    const t: Table = {
      id: "at",
      columns: [
        { name: "a", type: "number" },
        {
          name: "f",
          type: "formula",
          expr: '"a@b" == "a@b" ? 1 : 0',
        },
      ],
      rows: [[1]],
    };
    expect(recalcTable(t).rows[0]?.[1]).toBe(1);
  });
});

describe("recalcTable math catalog", () => {
  function oneExpr(expr: string, rows: number[][]): (number | string)[][] {
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "f", type: "formula", expr },
      ],
      rows,
    };
    return recalcTable(t).rows;
  }

  it("provides pi, tau, and e as constants", () => {
    expect(oneExpr("sin(pi)", [[1]])[0]?.[2]).toBeCloseTo(0, 10);
    expect(oneExpr("cos(tau)", [[1]])[0]?.[2]).toBeCloseTo(1, 10);
    expect(oneExpr("ln(e)", [[1]])[0]?.[2]).toBeCloseTo(1, 10);
  });

  it("a column of the same name shadows the constant", () => {
    const t: Table = {
      id: "m",
      columns: [
        { name: "e", type: "number" },
        { name: "f", type: "formula", expr: "e * 2" },
      ],
      rows: [[21]],
    };
    expect(recalcTable(t).rows[0]?.[1]).toBe(42);
  });

  it("scalar transforms: roots, logs, powers, trig, utility", () => {
    expect(oneExpr("x | sqrt()", [[9]])[0]?.[2]).toBe(3);
    expect(oneExpr("x | cbrt()", [[27]])[0]?.[2]).toBe(3);
    expect(oneExpr("x | pow(3)", [[2]])[0]?.[2]).toBe(8);
    expect(oneExpr("x | ln()", [[Math.exp(2)]])[0]?.[2]).toBeCloseTo(2, 10);
    expect(oneExpr("x | log10()", [[1000]])[0]?.[2]).toBeCloseTo(3, 10);
    expect(oneExpr("x | log2()", [[8]])[0]?.[2]).toBe(3);
    expect(oneExpr("x | sin()", [[0.5]])[0]?.[2]).toBeCloseTo(
      Math.sin(0.5),
      10,
    );
    expect(oneExpr("x | tanh()", [[0.5]])[0]?.[2]).toBeCloseTo(
      Math.tanh(0.5),
      10,
    );
    expect(oneExpr("x | deg()", [[Math.PI]])[0]?.[2]).toBeCloseTo(180, 10);
    expect(oneExpr("x | rad()", [[180]])[0]?.[2]).toBeCloseTo(Math.PI, 10);
    // atan2: the piped value is y.
    expect(oneExpr("x | atan2(1)", [[1]])[0]?.[2]).toBeCloseTo(Math.PI / 4, 10);
    // True modulo: the result takes the divisor's sign.
    expect(oneExpr("-5 | mod(3)", [[1]])[0]?.[2]).toBe(1);
    expect(oneExpr("-5 | mod(-3)", [[1]])[0]?.[2]).toBe(-2);
    expect(oneExpr("x | clamp(0, 10)", [[-4]])[0]?.[2]).toBe(0);
    expect(oneExpr("x | sign()", [[-4]])[0]?.[2]).toBe(-1);
    expect(oneExpr("x | hypot(y)", [[3, 4]])[0]?.[2]).toBe(5);
  });

  it("min and max are variadic over scalars and aggregate arrays", () => {
    expect(oneExpr("x | min(y, 1)", [[5, 3]])[0]?.[2]).toBe(1);
    expect(oneExpr("x | max(y, 7)", [[5, 3]])[0]?.[2]).toBe(7);
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        { name: "f", type: "formula", expr: "self.col.x | max()" },
      ],
      rows: [[5], [3], [9]],
    };
    expect(recalcTable(t).rows.every((r) => r[1] === 9)).toBe(true);
  });

  it("self.col aggregates skip empty and non-finite cells", () => {
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        { name: "s", type: "formula", expr: "self.col.x | sum()" },
        { name: "c", type: "formula", expr: "self.col.x | count()" },
        { name: "mean", type: "formula", expr: "self.col.x | mean()" },
        { name: "med", type: "formula", expr: "self.col.x | median()" },
        { name: "sd", type: "formula", expr: "self.col.x | stdev()" },
        { name: "f", type: "formula", expr: "self.col.x | first()" },
        { name: "l", type: "formula", expr: "self.col.x | last()" },
      ],
      rows: [[1], [""], [3], [7]],
    };
    const out = recalcTable(t).rows;
    const row = out[0] ?? [];
    expect(row[1]).toBe(11); // sum
    expect(row[2]).toBe(3); // count (empty skipped)
    expect(row[3]).toBeCloseTo(11 / 3, 10); // mean
    expect(row[4]).toBe(3); // median of [1,3,7]
    // Sample stdev of [1,3,7]
    const sd = Math.sqrt(
      ((1 - 11 / 3) ** 2 + (3 - 11 / 3) ** 2 + (7 - 11 / 3) ** 2) / 2,
    );
    expect(row[5]).toBeCloseTo(sd, 10);
    expect(row[6]).toBe(1); // first
    expect(row[7]).toBe(7); // last
  });

  it("the direct DFT computes known bins of a cosine tone", () => {
    // cos(2*pi*1*n/4) = [1, 0, -1, 0]: all energy is in bin 1.
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        {
          name: "re",
          type: "formula",
          expr: "self.col.x | dftRe(self.row - 1)",
        },
        {
          name: "im",
          type: "formula",
          expr: "self.col.x | dftIm(self.row - 1)",
        },
        {
          name: "mag",
          type: "formula",
          expr: "self.col.x | dftMag(self.row - 1)",
        },
      ],
      rows: [[1], [0], [-1], [0]],
    };
    const out = recalcTable(t).rows;
    expect(out[1]?.[3]).toBeCloseTo(2, 10); // bin 1 magnitude
    expect(out[0]?.[1]).toBeCloseTo(0, 10); // bin 0 real
    expect(out[1]?.[2]).toBeCloseTo(0, 10); // bin 1 imaginary
    expect(out[3]?.[3]).toBeCloseTo(2, 10); // conjugate symmetry: bin 3
  });

  it("the radix-2 FFT agrees with the per-bin DFT", () => {
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        {
          name: "dft",
          type: "formula",
          expr: "self.col.x | dftMag(self.row - 1)",
        },
        {
          name: "fft",
          type: "formula",
          expr: "self.col.x | fft() | at(self.row - 1)",
        },
      ],
      rows: [[3], [1], [-2], [5], [0.5], [-1.5], [4], [2.25]],
    };
    const out = recalcTable(t).rows;
    out.forEach((row) => {
      expect(row[2]).toBeCloseTo(row[1] as number, 10);
    });
  });

  it("fft rejects a non-power-of-two sample count with a visible error", () => {
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        { name: "f", type: "formula", expr: "self.col.x | fft() | at(0)" },
      ],
      rows: [[1], [2], [3]],
    };
    expect(() => recalcTable(t)).toThrow(/power-of-two/);
  });

  it("sma is a simple moving average ending at the row", () => {
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        {
          name: "f",
          type: "formula",
          expr: "self.col.x | sma(self.row - 1, 2)",
        },
      ],
      rows: [[1], [5], [3]],
    };
    const out = recalcTable(t).rows;
    expect(out[0]?.[1]).toBe(1); // window clipped at the first row
    expect(out[1]?.[1]).toBe(3); // (1+5)/2
    expect(out[2]?.[1]).toBe(4); // (5+3)/2
  });

  it("self.col validates the referenced column", () => {
    const base = (expr: string): Table => ({
      id: "m",
      columns: [
        { name: "a", type: "number" },
        { name: "txt", type: "text" },
        { name: "f", type: "formula", expr },
        { name: "later", type: "formula", expr: "a + 1" },
      ],
      rows: [[1, "x"]],
    });
    expect(() => recalcTable(base("self.col.nope | sum()"))).toThrow(
      /unknown column 'nope'/,
    );
    expect(() => recalcTable(base("self.col.txt | sum()"))).toThrow(
      /non-numeric column 'txt'/,
    );
    expect(() => recalcTable(base("self.col.later | sum()"))).toThrow(
      /columns to its left/,
    );
    expect(() => recalcTable(base("self.col.f | sum()"))).toThrow(
      /self-reference/,
    );
    expect(() => recalcTable(base("col | sum()"))).toThrow(/col follows self/);
  });

  it("recurrences chain with transforms: an EMA low-pass filter", () => {
    // y_n = a*x_n + (1-a)*y_{n-1} with a = 0.5 on a unit step.
    const t: Table = {
      id: "m",
      columns: [
        { name: "x", type: "number" },
        {
          name: "y",
          type: "formula",
          expr: "0.5 * x + (self.row == 1 ? 0 : 0.5 * self.prev.y)",
        },
      ],
      rows: [[1], [1], [1]],
    };
    const out = recalcTable(t).rows;
    expect(out[0]?.[1]).toBeCloseTo(0.5, 10);
    expect(out[1]?.[1]).toBeCloseTo(0.75, 10);
    expect(out[2]?.[1]).toBeCloseTo(0.875, 10);
  });
});
