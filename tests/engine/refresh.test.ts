import { describe, expect, it } from "vitest";
import {
  importOrigin,
  splitImportOrigin,
  type ParsedImport,
} from "@folio/engine/ingest";
import { matchRefreshTargets, refreshedTable } from "@folio/engine/refresh";
import type { Table } from "@folio/engine/index";

/**
 * Refresh from a file (docs/specs/data-import.md, "Refresh from a
 * file"): matching a picked file to the document's imported tables,
 * and merging new data into a table without losing what the document
 * added to it.
 */

describe("importOrigin / splitImportOrigin", () => {
  it("records and splits file#table provenance", () => {
    expect(importOrigin("cdr_2026_03.db", "cdr")).toBe("cdr_2026_03.db#cdr");
    expect(importOrigin("sales.csv")).toBe("sales.csv");
    expect(splitImportOrigin("cdr_2026_03.db#cdr")).toEqual({
      file: "cdr_2026_03.db",
      table: "cdr",
    });
    expect(splitImportOrigin("sales.csv")).toEqual({ file: "sales.csv" });
  });
});

describe("matchRefreshTargets", () => {
  const doc: { id: string; import?: string | undefined }[] = [
    { id: "calls", import: "cdr_2026_01.db#cdr" },
    { id: "quality", import: "cdr_2026_01.db#call_quality" },
    { id: "sales", import: "sales.csv" },
    { id: "rates", import: "https://www.bankofengland.co.uk/x.csv" },
    { id: "hand", import: undefined },
  ];

  it("a picked SQLite file refreshes its tables, exactly named or by month family", () => {
    const targets = matchRefreshTargets(doc, "cdr_2026_02.db", [
      "cdr",
      "call_quality",
    ]);
    expect(targets).toEqual([
      {
        id: "calls",
        from: "cdr_2026_01.db#cdr",
        to: "cdr_2026_02.db#cdr",
      },
      {
        id: "quality",
        from: "cdr_2026_01.db#call_quality",
        to: "cdr_2026_02.db#call_quality",
      },
    ]);
  });

  it("the same file name refreshes exactly, table part included", () => {
    expect(matchRefreshTargets(doc, "cdr_2026_01.db", ["cdr"])).toEqual([
      { id: "calls", from: "cdr_2026_01.db#cdr", to: "cdr_2026_01.db#cdr" },
    ]);
  });

  it("a picked CSV refreshes only the exact file name", () => {
    expect(matchRefreshTargets(doc, "sales.csv", [])).toEqual([
      { id: "sales", from: "sales.csv", to: "sales.csv" },
    ]);
    expect(matchRefreshTargets(doc, "sales-2.csv", [])).toEqual([]);
  });

  it("a SQLite table missing from the picked file is not refreshed", () => {
    expect(matchRefreshTargets(doc, "cdr_2026_02.db", ["cdr"])).toEqual([
      { id: "calls", from: "cdr_2026_01.db#cdr", to: "cdr_2026_02.db#cdr" },
    ]);
  });

  it("unrelated families, web addresses and hand-made tables never match", () => {
    expect(matchRefreshTargets(doc, "other_2026_02.db", ["cdr"])).toEqual([]);
    expect(matchRefreshTargets(doc, "x.csv", [])).toEqual([]);
  });
});

describe("refreshedTable", () => {
  const parsed: ParsedImport = {
    columns: [
      { name: "start_at", type: "number" },
      { name: "total_billed", type: "number" },
    ],
    rows: [
      [1775001600, 1.25],
      [1775088000, 0],
    ],
  };
  const table: Table = {
    id: "calls",
    caption: "March calls",
    import: "cdr_2026_03.db#cdr",
    retrieved: "2026-03-31",
    cite: "acme_cdr",
    licence: "personal-use",
    show: 24,
    columns: [
      { name: "start_at", type: "number", unit: "s" },
      { name: "total_billed", type: "number", format: "currency" },
      { name: "day", type: "formula", expr: "fromUnix(start_at)" },
    ],
    rows: [
      [1772323200, 0.5, "2026-03-01"],
      [1772409600, 0.75, "2026-03-02"],
    ],
  };

  it("takes the new data and provenance, keeps identity and settings", () => {
    const next = refreshedTable(
      table,
      parsed,
      "cdr_2026_04.db#cdr",
      "2026-04-30",
    );
    expect(next.id).toBe("calls");
    expect(next.caption).toBe("March calls");
    expect(next.cite).toBe("acme_cdr");
    expect(next.licence).toBe("personal-use");
    expect(next.show).toBe(24);
    expect(next.import).toBe("cdr_2026_04.db#cdr");
    expect(next.retrieved).toBe("2026-04-30");
    expect(next.rows).toEqual([
      [1775001600, 1.25, ""],
      [1775088000, 0, ""],
    ]);
  });

  it("keeps column display settings by name and the author's formula columns", () => {
    const next = refreshedTable(
      table,
      parsed,
      "cdr_2026_04.db#cdr",
      "2026-04-30",
    );
    expect(next.columns[0]).toEqual({
      name: "start_at",
      type: "number",
      unit: "s",
    });
    expect(next.columns[1]).toEqual({
      name: "total_billed",
      type: "number",
      format: "currency",
    });
    expect(next.columns[2]).toEqual({
      name: "day",
      type: "formula",
      expr: "fromUnix(start_at)",
    });
  });

  it("leaves retrieved alone when the import never recorded one", () => {
    const noRetrieved: Table = { ...table };
    delete noRetrieved.retrieved;
    const next = refreshedTable(
      noRetrieved,
      parsed,
      "cdr_2026_04.db#cdr",
      "2026-04-30",
    );
    expect(next.retrieved).toBeUndefined();
  });
});
