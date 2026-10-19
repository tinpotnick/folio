import { describe, expect, it } from "vitest";
import { recalcTable } from "@folio/engine/recalc";
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
    expect(() => recalcTable(t)).toThrow(/unknown or non-numeric column/);
  });

  it("rejects text columns as formula references", () => {
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

  it("rejects formulas referencing other formula columns (v0 contract)", () => {
    const t: Table = {
      id: "chain",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "b + 1" },
      ],
      rows: [[2]],
    };
    expect(() => recalcTable(t)).toThrow(/non-numeric column 'b'/);
  });
});
