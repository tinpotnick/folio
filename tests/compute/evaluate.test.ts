import { describe, expect, it } from "vitest";
import {
  computeOutputs,
  datasetRows,
  formatComputeInfo,
  inputName,
  parseComputeInfo,
} from "../../src/compute/evaluate.js";
import type { Table } from "@folio/engine/index.js";

const table: Table = {
  id: "budget",
  columns: [
    { name: "item", type: "text" },
    { name: "cost", type: "number", unit: "£k" },
  ],
  rows: [
    ["Engineering", 30],
    ["Design", 12],
  ],
};

describe("parseComputeInfo", () => {
  it("binds data and out", () => {
    expect(parseComputeInfo("data=@budget out=forecast")).toEqual({
      data: ["budget"],
      out: ["forecast"],
    });
  });

  it("binds several datasets and outputs (comma lists)", () => {
    expect(
      parseComputeInfo("data=@budget,@rates out=forecast,sensitivity"),
    ).toEqual({
      data: ["budget", "rates"],
      out: ["forecast", "sensitivity"],
    });
  });

  it("is inert without binding info - plain python is code", () => {
    expect(parseComputeInfo(undefined)).toBeNull();
    expect(parseComputeInfo("")).toBeNull();
    expect(parseComputeInfo('title="example"')).toBeNull();
  });

  it("round-trips through formatComputeInfo", () => {
    const binding = parseComputeInfo(
      "data=@budget,@rates out=forecast,sensitivity",
    );
    expect(formatComputeInfo(binding ?? { data: [], out: [] })).toBe(
      "data=@budget,@rates out=forecast,sensitivity",
    );
  });
});

describe("inputName", () => {
  it("accepts a word", () => {
    expect(inputName("budget")).toBe("budget");
  });
  it("refuses a non-identifier id, naming it", () => {
    expect(() => inputName("launch-budget")).toThrow(/@launch-budget/);
  });
  it("refuses a Python keyword", () => {
    expect(() => inputName("import")).toThrow();
  });
});

describe("datasetRows", () => {
  it("is a list of dicts keyed by column name", () => {
    expect(datasetRows(table)).toEqual([
      { item: "Engineering", cost: 30 },
      { item: "Design", cost: 12 },
    ]);
  });
});

describe("computeOutputs", () => {
  it("accepts one table for one out, giving it the id", () => {
    const outs = computeOutputs({ data: ["budget"], out: ["forecast"] }, [
      { month: 1, spend: 7 },
    ]);
    expect(outs[0]?.id).toBe("forecast");
    expect(outs[0]?.columns).toEqual([
      { name: "month", type: "number" },
      { name: "spend", type: "number" },
    ]);
    expect(outs[0]?.rows).toEqual([[1, 7]]);
  });

  it("accepts a tuple matching several outs, by position", () => {
    const outs = computeOutputs({ data: [], out: ["forecast", "warning"] }, [
      [{ a: 1 }],
      [{ b: "high" }],
    ]);
    expect(outs.map((t) => t.id)).toEqual(["forecast", "warning"]);
    expect(outs[1]?.rows).toEqual([["high"]]);
  });

  it("accepts the explicit {columns, rows} form", () => {
    const outs = computeOutputs(
      { data: [], out: ["forecast"] },
      {
        columns: [
          { name: "month", type: "number", unit: "mo" },
          { name: "spend", type: "number", unit: "£k" },
        ],
        rows: [[1, 7]],
      },
    );
    expect(outs[0]?.columns[0]).toEqual({
      name: "month",
      type: "number",
      unit: "mo",
    });
    expect(outs[0]?.rows).toEqual([[1, 7]]);
  });

  it("errors on a count mismatch with out=", () => {
    expect(() =>
      computeOutputs({ data: [], out: ["a", "b"] }, [{ x: 1 }]),
    ).toThrow(/out= names 2/);
  });

  it("errors on a missing out=", () => {
    expect(() => computeOutputs({ data: [], out: [] }, [{ x: 1 }])).toThrow(
      /no out=/,
    );
  });

  it("errors on an empty inferred table", () => {
    expect(() =>
      computeOutputs({ data: [], out: ["a", "b"] }, [[], []]),
    ).toThrow(/empty/);
  });

  it("errors on a non-table return", () => {
    expect(() => computeOutputs({ data: [], out: ["a"] }, 42 as never)).toThrow(
      /list of dicts/,
    );
  });

  it("normalizes cells: booleans to 1/0, null to empty", () => {
    const outs = computeOutputs({ data: [], out: ["a"] }, [
      { flag: true, off: false, blank: null },
    ]);
    expect(outs[0]?.rows).toEqual([[1, 0, ""]]);
  });
});
