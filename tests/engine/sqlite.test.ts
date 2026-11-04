import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isSqliteFile, openSqlite } from "@folio/engine/sqlite";
import { importedTable } from "@folio/engine/ingest";
import { parseDoc, serializeDoc } from "@folio/engine/doc";

/**
 * The SQLite file reader (docs/specs/data-import.md, "SQLite files"):
 * binary fixtures in tests/engine/fixtures/ (regenerate with
 * make-fixtures.py) - a CDR-like monthly file, a multi-page one, a
 * UTF-16 one, a WAL one, and the error shapes.
 */

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(`tests/engine/fixtures/${name}`));

describe("isSqliteFile", () => {
  it("recognises the magic header, whatever the extension", () => {
    expect(isSqliteFile(fixture("cdr-like.db"))).toBe(true);
    expect(isSqliteFile(fixture("empty.db"))).toBe(true);
    expect(isSqliteFile(fixture("notdb.bin"))).toBe(false);
    expect(isSqliteFile(new Uint8Array(10))).toBe(false);
  });
});

describe("openSqlite", () => {
  it("refuses a file that is not a SQLite database, with guidance", () => {
    expect(() => openSqlite(fixture("notdb.bin"))).toThrow(
      /not a SQLite database file/,
    );
  });

  it("an empty database opens and lists no tables", () => {
    expect(openSqlite(fixture("empty.db")).tables()).toEqual([]);
  });

  it("lists the CDR file's tables with row counts and columns", () => {
    const tables = openSqlite(fixture("cdr-like.db")).tables();
    expect(tables.map((t) => [t.name, t.internal])).toEqual([
      ["cdr", false],
      ["call_quality", false],
      ["monthly_totals", false],
      // litestream's bookkeeping is present in the file, flagged -
      // listed, never hidden.
      ["_litestream_seq", true],
      ["_litestream_lock", true],
    ]);
    const cdr = tables[0];
    expect(cdr?.rowCount).toBe(40);
    expect(cdr?.columns.map((c) => c.name)).toEqual([
      "uuid",
      "bleg_uuid",
      "caller_id_name",
      "caller_id_number",
      "destination_number",
      "start_at",
      "answer_at",
      "end_at",
      "duration",
      "bill_seconds",
      "hangup_cause",
      "total_billed",
      "recorded",
      "transcription",
    ]);
    expect(cdr?.columns[0]?.decl).toMatch(/TEXT/i);
    expect(tables[2]?.rowCount).toBe(1);
  });

  it("skips sqlite_sequence when listing tables", () => {
    const names = openSqlite(fixture("with-sequence.db"))
      .tables()
      .map((t) => t.name);
    expect(names).toEqual(["notes", "plain"]);
  });

  it("flags internal bookkeeping tables (_litestream_*) and still reads them by name", () => {
    const db = openSqlite(fixture("cdr-like.db"));
    // The fixture carries litestream's _litestream_seq/_litestream_lock
    // (it was live-replicated): flagged internal so the picker can
    // group them - but listed, so no table can go missing.
    expect(
      db
        .tables()
        .filter((t) => t.internal)
        .map((t) => t.name),
    ).toEqual(["_litestream_seq", "_litestream_lock"]);
    expect(db.read("_litestream_seq").rows).toEqual([[1, 42]]);
  });
});

describe("read", () => {
  it("reads the cdr table with schema-driven types and real values", () => {
    const parsed = openSqlite(fixture("cdr-like.db")).read("cdr");
    const names = parsed.columns.map((c) => [c.name, c.type]);
    expect(names).toEqual([
      ["uuid", "text"],
      ["bleg_uuid", "text"],
      ["caller_id_name", "text"],
      ["caller_id_number", "text"],
      ["destination_number", "text"],
      ["start_at", "number"],
      ["answer_at", "number"],
      ["end_at", "number"],
      ["duration", "number"],
      ["bill_seconds", "number"],
      ["hangup_cause", "text"],
      ["total_billed", "number"],
      ["recorded", "number"],
      ["transcription", "text"],
    ]);
    expect(parsed.rows).toHaveLength(40);
    const startAt = parsed.columns.findIndex((c) => c.name === "start_at");
    const caller = parsed.columns.findIndex(
      (c) => c.name === "caller_id_number",
    );
    const billed = parsed.columns.findIndex((c) => c.name === "total_billed");
    for (const row of parsed.rows) {
      // March 2026, as unix epoch seconds, carried as numbers.
      expect(typeof row[startAt]).toBe("number");
      expect(Number(row[startAt])).toBeGreaterThanOrEqual(1772323200);
      expect(Number(row[startAt])).toBeLessThan(1775001600);
      // TEXT stays text: a leading-zero number keeps its zero.
      expect(typeof row[caller]).toBe("string");
      expect(typeof row[billed]).toBe("number");
    }
    // Every caller number is one of the text values, leading zeros kept.
    const callers = [
      "+441632960123",
      "01632960123",
      "+15551234567",
      "00441632960123",
    ];
    for (const row of parsed.rows) {
      expect(callers).toContain(row[caller]);
    }
    // bleg_uuid: mostly blank, a few second legs linking to a primary uuid.
    const bleg = parsed.columns.findIndex((c) => c.name === "bleg_uuid");
    const uuid = parsed.columns.findIndex((c) => c.name === "uuid");
    const ids = new Set(parsed.rows.map((r) => String(r[uuid])));
    const legs = parsed.rows.filter((r) => String(r[bleg]) !== "");
    expect(legs.length).toBeGreaterThan(0);
    for (const r of legs) expect(ids.has(String(r[bleg]))).toBe(true);
  });

  it("reads a row that spilled onto overflow pages whole", () => {
    const parsed = openSqlite(fixture("cdr-like.db")).read("cdr");
    const t = parsed.columns.findIndex((c) => c.name === "transcription");
    const long = parsed.rows.find((r) => String(r[t]).length > 4000);
    expect(String(long?.[t])).toBe("word ".repeat(3000));
  });

  it("reads the INTEGER PRIMARY KEY rowid alias as its value", () => {
    const parsed = openSqlite(fixture("cdr-like.db")).read("monthly_totals");
    expect(parsed.columns[0]).toEqual({ name: "id", type: "number" });
    expect(parsed.rows).toEqual([[1, expect.any(Number), 40]]);
    expect(parsed.rows[0]?.[2]).toBe(40);
  });

  it("reads a multi-page b-tree (interior pages) completely", () => {
    const parsed = openSqlite(fixture("big.db")).read("events");
    expect(parsed.rows).toHaveLength(2000);
    expect(parsed.rows[0]?.[0]).toBe(1);
    expect(parsed.rows[1999]?.[0]).toBe(2000);
    expect(parsed.columns.map((c) => c.type)).toEqual([
      "number",
      "number",
      "text",
      "number",
    ]);
  });

  it("decodes UTF-16 databases", () => {
    const parsed = openSqlite(fixture("utf16.db")).read("places");
    expect(parsed.rows.map((r) => r[1])).toEqual([
      "Zürich",
      "Москва",
      "Helsinki",
    ]);
    expect(parsed.columns[2]?.type).toBe("number");
  });

  it("reads a cleanly closed WAL database from the one file", () => {
    const parsed = openSqlite(fixture("wal.db")).read("readings");
    expect(parsed.rows).toHaveLength(24);
  });

  it("names the tables when the asked-for one is missing", () => {
    expect(() => openSqlite(fixture("cdr-like.db")).read("nope")).toThrow(
      /no table named "nope".*cdr, call_quality, monthly_totals/,
    );
  });

  it("a WITHOUT ROWID table lists but fails to read, clearly", () => {
    const db = openSqlite(fixture("withoutrowid.db"));
    expect(db.tables().map((t) => t.name)).toEqual(["kv"]);
    expect(() => db.read("kv")).toThrow(/WITHOUT ROWID/);
  });

  it("table names match case-insensitively", () => {
    expect(openSqlite(fixture("cdr-like.db")).read("CDR").rows).toHaveLength(
      40,
    );
  });
});

describe("imported data vs the document round-trip", () => {
  // Regression: the reader keeps a TEXT caller id as "01632960123",
  // and the document model must not drop the zero when the table is
  // serialized to Markdown and parsed back (save/reload).
  it("an imported caller number keeps its leading zero through serialize + re-parse", () => {
    const parsed = openSqlite(fixture("cdr-like.db")).read("cdr");
    const table = importedTable("calls", parsed, "cdr_2026_03.db#cdr");
    const doc = parseDoc("# Calls\n");
    doc.blocks.push({ kind: "table", table });
    const md = serializeDoc(doc);
    expect(md).toContain("01632960123");
    const back = parseDoc(md).blocks.find((b) => b.kind === "table");
    if (back?.kind !== "table") throw new Error("not a table");
    const caller = back.table.columns.findIndex(
      (c) => c.name === "caller_id_number",
    );
    expect(back.table.columns[caller]?.type).toBe("text");
    expect(back.table.rows.some((r) => r[caller] === "01632960123")).toBe(true);
  });
});

describe("provenance round-trip", () => {
  it("a table imported from a SQLite file keeps file#table byte-identically", () => {
    const src = [
      "::: table {#calls}",
      'import: "cdr_2026_03.db#cdr"',
      "columns:",
      "  - {name: start_at, type: number}",
      "data:",
      "  - [1772323200]",
      ":::",
      "",
    ].join("\n");
    expect(serializeDoc(parseDoc(src))).toBe(src);
  });
});
