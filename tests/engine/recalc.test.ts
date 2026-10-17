import { describe, expect, it } from "vitest";
import { parseFormula, recalcTable } from "@folio/engine/recalc";
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

describe("parseFormula", () => {
  it("parses column arithmetic with precedence", () => {
    const ast = parseFormula("(q3 - q2) / q2");
    expect(ast).toEqual({
      kind: "bin",
      op: "/",
      l: {
        kind: "bin",
        op: "-",
        l: { kind: "column", name: "q3" },
        r: { kind: "column", name: "q2" },
      },
      r: { kind: "column", name: "q2" },
    });
  });

  it("rejects trailing tokens", () => {
    expect(() => parseFormula("q2 5")).toThrow();
  });

  it("rejects unbalanced parens", () => {
    expect(() => parseFormula("(q2")).toThrow();
  });
});

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

  it("throws on unknown column reference", () => {
    const t: Table = {
      id: "bad",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "missing * 2" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/unknown or non-numeric column/);
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
});
