import { describe, expect, it } from "vitest";
import {
  importedTable,
  parseCsv,
  parseImport,
  parseJsonTable,
} from "@folio/engine/ingest";
import { parseDoc, serializeDoc } from "@folio/engine/doc";

describe("parseCsv", () => {
  it("takes the first row as the header and infers number columns", () => {
    const out = parseCsv("region,q2\nNorth,412\nSouth,388\n");
    expect(out.columns).toEqual([
      { name: "region", type: "text" },
      { name: "q2", type: "number" },
    ]);
    expect(out.rows).toEqual([
      ["North", 412],
      ["South", 388],
    ]);
  });

  it("handles RFC-4180 quoting: commas, quotes, newlines in fields", () => {
    const out = parseCsv(
      'name,note\n"Smith, John","said ""hi"""\n"Multi\nline",plain\n',
    );
    expect(out.rows).toEqual([
      ["Smith, John", 'said "hi"'],
      ["Multi\nline", "plain"],
    ]);
    expect(out.columns.every((c) => c.type === "text")).toBe(true);
  });

  it("a numeric column with any text value stays text", () => {
    const out = parseCsv("v\n1\nabout 3\n");
    expect(out.columns[0]?.type).toBe("text");
  });

  it("published missing markers (FRED's '.', NA, n/a) read as empty", () => {
    const out = parseCsv(
      "observation_date,rate\n2024-01-01,5.25\n2024-02-01,.\n2024-03-01,n/a\n",
    );
    expect(out.columns.map((c) => c.type)).toEqual(["date", "number"]);
    expect(out.rows.map((r) => r[1])).toEqual([5.25, "", ""]);
  });

  it("date columns are inferred and written ISO", () => {
    // The Bank of England's shape, and ONS months.
    const boe = parseCsv("DATE,IUMABEDR\n31 Jan 2020,0.75\n29 Feb 2020,0.75\n");
    expect(boe.columns[0]?.type).toBe("date");
    expect(boe.rows.map((r) => r[0])).toEqual(["2020-01-31", "2020-02-29"]);
    const ons = parseCsv("month,cpi\n2024 JAN,131.5\n2024 FEB,132.3\n");
    expect(ons.rows[1]?.[0]).toBe("2024-02-01");
    // Years alone are numbers, not dates.
    expect(parseCsv("year,v\n2020,1\n2021,2\n").columns[0]?.type).toBe(
      "number",
    );
  });

  it("sanitizes header names to identifier-legal, deduped, never empty", () => {
    const out = parseCsv("Sales Region,sales region,,2024 total\n");
    expect(out.columns.map((c) => c.name)).toEqual([
      "Sales_Region",
      "sales_region_2",
      "col_3",
      "c_2024_total",
    ]);
  });

  it("CRLF rows work; rows longer than the header truncate to it", () => {
    const out = parseCsv("a,b\r\n1,2,\r\n");
    expect(out.rows).toEqual([[1, 2]]);
  });

  it("empty input is an error", () => {
    expect(() => parseCsv("")).toThrow(/empty/);
  });
});

describe("parseJsonTable", () => {
  it("an array of objects: keys become columns in first-seen order", () => {
    const out = parseJsonTable(
      '[{"region":"North","v":10},{"region":"South","v":20}]',
    );
    expect(out.columns).toEqual([
      { name: "region", type: "text" },
      { name: "v", type: "number" },
    ]);
    expect(out.rows).toEqual([
      ["North", 10],
      ["South", 20],
    ]);
  });

  it("an array of arrays with a string header row", () => {
    const out = parseJsonTable('[["a","b"],[1,2],[3,4]]');
    expect(out.columns).toEqual([
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ]);
    expect(out.rows).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("invalid JSON and wrong shapes are errors with guidance", () => {
    expect(() => parseJsonTable("{")).toThrow(/Invalid JSON/);
    expect(() => parseJsonTable('{"a":1}')).toThrow(/array of objects/);
    expect(() => parseJsonTable("[]")).toThrow(/array of objects/);
  });

  it("parseImport sniffs by format name", () => {
    expect(parseImport("a,b\n1,2\n", "csv").columns).toHaveLength(2);
    expect(parseImport('[{"a":1}]', "json").rows).toEqual([[1]]);
  });
});

describe("importedTable", () => {
  it("carries the origin as the import provenance key", () => {
    const t = importedTable(
      "sales",
      parseCsv("region,v\nNorth,1\n"),
      "sales Q3.csv",
    );
    expect(t.import).toBe("sales Q3.csv");
  });

  it("the import key round-trips through the directive byte-identically", () => {
    const md =
      "::: table {#sales}\n" +
      'import: "sales Q3.csv"\n' +
      "columns:\n" +
      "  - {name: region, type: text}\n" +
      "  - {name: v, type: number}\n" +
      "data:\n" +
      "  - [North, 1]\n" +
      ":::\n";
    expect(serializeDoc(parseDoc(md))).toBe(md);
  });
});
