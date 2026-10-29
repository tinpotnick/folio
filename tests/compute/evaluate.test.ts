import { describe, expect, it } from "vitest";
import {
  computeOutputs,
  datasetRows,
  formatComputeInfo,
  inputName,
  parseComputeInfo,
  pythonError,
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

describe("parseComputeInfo: out= alone", () => {
  it("a script may make data from nothing (out= without data=)", () => {
    expect(parseComputeInfo("out=greeting")).toEqual({
      data: [],
      out: ["greeting"],
    });
  });
});

describe("computeOutputs: variables become datasets and values", () => {
  const binding = { data: ["budget"], out: ["fit", "slope", "when"] };

  it("a table becomes a computed dataset; a number or date a value", () => {
    const [fit, slope, when] = computeOutputs(binding, {
      fit: {
        columns: ["day", "trend", "note"],
        rows: [
          [1, 410, "low"],
          [2, 418.6, ""],
        ],
      },
      slope: { value: 8.56 },
      when: { value: "2026-01-31" },
    });
    expect(fit).toEqual({
      id: "fit",
      computed: "python",
      columns: [
        { name: "day", type: "number" },
        { name: "trend", type: "number" },
        { name: "note", type: "text" },
      ],
      rows: [
        [1, 410, "low"],
        [2, 418.6, ""],
      ],
    });
    expect(slope).toMatchObject({
      id: "slope",
      value: true,
      columns: [{ name: "value", type: "number" }],
      rows: [[8.56]],
    });
    expect(when?.columns[0]?.type).toBe("date");
  });

  it("a variable the script could not publish says why, by name", () => {
    expect(() =>
      computeOutputs(
        { data: [], out: ["xs"] },
        { xs: { error: "xs is a list - publish a table ..." } },
      ),
    ).toThrow(/^xs is a list/);
  });

  it("no out= says how to publish", () => {
    expect(() => computeOutputs({ data: [], out: [] }, {})).toThrow(
      /name the variables to publish/,
    );
  });
});

describe("pythonError", () => {
  it("is the error and the script's line, not Pyodide's traceback", () => {
    const tb = [
      "Traceback (most recent call last):",
      '  File "/lib/python314.zip/_pyodide/_base.py", line 619, in eval_code_async',
      "    await CodeRunner(",
      '  File "<exec>", line 2, in <module>',
      "ZeroDivisionError: division by zero",
    ].join("\n");
    expect(pythonError(new Error(tb))).toBe(
      "ZeroDivisionError: division by zero (line 2)",
    );
  });

  it("keeps a message with no script line as it is", () => {
    expect(pythonError(new Error("NameError: x"))).toBe("NameError: x");
  });

  it("a leftover return (the first design) says what replaced it", () => {
    const tb = [
      '  File "<exec>", line 3',
      "SyntaxError: 'return' outside function",
    ].join("\n");
    expect(pythonError(new Error(tb))).toMatch(
      /publishes variables instead: name them in out=/,
    );
  });
});
