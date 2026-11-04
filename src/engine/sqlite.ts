/**
 * A read-only SQLite database FILE reader (docs/specs/data-import.md,
 * "SQLite files"): the standard file format
 * (https://www.sqlite.org/fileformat2.html) parsed directly - no
 * dependency, no WASM, nothing to load, so it works offline in every
 * host (web, Tauri webviews, headless tests) per ADR-0005/ADR-0007.
 *
 * Supported: ordinary rowid tables (what a monthly CDR file is), all
 * three text encodings, overflow pages, multi-level b-trees, and the
 * INTEGER PRIMARY KEY rowid alias. Not supported, with a clear error:
 * WITHOUT ROWID tables, generated columns, and files that are not a
 * SQLite database at all (an encrypted file fails the magic header).
 *
 * A database in WAL mode reads fine from the one file as long as it
 * was closed cleanly (SQLite checkpoints on close); an uncheckpointed
 * -wal sitting beside the file is not part of the file and cannot be
 * seen here.
 */
import type { Cell } from "./index.js";
import { applyTypes, sanitizeNames, type ParsedImport } from "./ingest.js";
import { looksLikeDates } from "./dates.js";

const MAGIC = "SQLite format 3\0";

/** The file starts with the SQLite magic header. */
export function isSqliteFile(bytes: Uint8Array): boolean {
  if (bytes.length < 100) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

export interface SqliteColumnInfo {
  name: string;
  /** The declared type, uppercased ("TEXT", "INTEGER", ...). */
  decl: string;
}

export interface SqliteTableInfo {
  name: string;
  rowCount: number;
  columns: SqliteColumnInfo[];
  /** Tool bookkeeping (leading underscore, e.g. litestream's
   * `_litestream_seq`): listed, but the picker groups these under
   * "Internal tables" so they never hide a real table. */
  internal: boolean;
}

export interface SqliteDb {
  /** Every ordinary table in the file, with row counts. */
  tables(): SqliteTableInfo[];
  /** One table as parsed import data: typed columns, typed values. */
  read(name: string): ParsedImport;
}

interface Db {
  bytes: Uint8Array;
  view: DataView;
  pageSize: number;
  /** Usable bytes per page (page size minus the reserved region). */
  usable: number;
  decoder: TextDecoder;
}

/** Open a SQLite file, or throw a message meant for the user. */
export function openSqlite(bytes: Uint8Array): SqliteDb {
  if (!isSqliteFile(bytes)) {
    throw new Error(
      "not a SQLite database file (it does not start with the SQLite header - an encrypted or different-format file)",
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rawPage = view.getUint16(16);
  const pageSize = rawPage === 1 ? 65536 : rawPage;
  if (pageSize < 512 || (pageSize & (pageSize - 1)) !== 0) {
    throw new Error("not a SQLite database file (bad page size)");
  }
  const reserved = view.getUint8(20);
  const enc = view.getUint32(56);
  if (enc !== 1 && enc !== 2 && enc !== 3) {
    throw new Error("not a SQLite database file (unknown text encoding)");
  }
  const db: Db = {
    bytes,
    view,
    pageSize,
    usable: pageSize - reserved,
    decoder: new TextDecoder(
      enc === 1 ? "utf-8" : enc === 2 ? "utf-16le" : "utf-16be",
    ),
  };
  const schema = readSchema(db);
  // sqlite_* never appear: SQLite reserves that prefix, so no user
  // table can be hidden by skipping it.
  const userTables = (): SchemaTable[] => schema.filter((t) => t.rootpage > 0);
  return {
    tables(): SqliteTableInfo[] {
      return userTables().map((t) => {
        // A table whose definition folio cannot read (WITHOUT ROWID,
        // generated columns) still lists - with no columns and no
        // count (its root is an index b-tree) - and fails clearly
        // only when read.
        let columns: SqliteColumnInfo[] = [];
        let rowCount = 0;
        try {
          columns = parseSchemaTable(t).columns;
          if (rootIsTableBtree(db, t.rootpage))
            rowCount = countRows(db, t.rootpage);
        } catch {
          columns = [];
        }
        return {
          name: t.name,
          rowCount,
          columns,
          internal: isInternalTable(t.name),
        };
      });
    },
    read(name: string): ParsedImport {
      // An explicit name reads any table, even an internal one the
      // picker does not list.
      const hit = schema.find(
        (t) => t.rootpage > 0 && t.name.toLowerCase() === name.toLowerCase(),
      );
      if (!hit) {
        const have = userTables()
          .map((t) => t.name)
          .join(", ");
        throw new Error(
          `no table named "${name}" in this file${have ? ` - it has: ${have}` : " - it has no tables"}`,
        );
      }
      return readTable(db, hit.rootpage, parseSchemaTable(hit));
    },
  };
}

/* --- Low-level file format --- */

/** A varint: 7 bits per byte, high bit continues; a 9th byte adds 8. */
function varint(view: DataView, at: number): [value: number, next: number] {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    const b = view.getUint8(at + i);
    result = result * 128 + (b & 0x7f);
    if ((b & 0x80) === 0) return [result, at + i + 1];
  }
  return [result * 256 + view.getUint8(at + 8), at + 9];
}

/** A big-endian two's-complement integer of 1,2,3,4,6 or 8 bytes. */
function signedInt(view: DataView, at: number, size: number): number {
  let v = 0;
  for (let i = 0; i < size; i++) v = v * 256 + view.getUint8(at + i);
  const bits = size * 8;
  if (v >= 2 ** (bits - 1)) v -= 2 ** bits;
  return v;
}

/** A table b-tree cell's payload, following the overflow chain. */
function readPayload(db: Db, at: number, len: number): Uint8Array {
  const U = db.usable;
  const maxLocal = U - 35;
  if (len <= maxLocal) return db.bytes.subarray(at, at + len);
  const minLocal = Math.floor(((U - 12) * 32) / 255) - 23;
  const k = minLocal + ((len - minLocal) % (U - 4));
  const local = k <= maxLocal ? k : minLocal;
  const out = new Uint8Array(len);
  out.set(db.bytes.subarray(at, at + local));
  let page = db.view.getUint32(at + local);
  let off = local;
  while (page !== 0 && off < len) {
    const base = (page - 1) * db.pageSize;
    const next = db.view.getUint32(base);
    const chunk = db.bytes.subarray(
      base + 4,
      base + 4 + Math.min(U - 4, len - off),
    );
    out.set(chunk, off);
    off += chunk.length;
    page = next;
  }
  if (off < len) throw new Error("corrupt SQLite file (broken overflow chain)");
  return out;
}

/**
 * Walk a table b-tree, visiting every row. Page 1 carries the 100-byte
 * file header before its b-tree header; cell pointers are relative to
 * the page start.
 */
function walkTable(
  db: Db,
  pageNo: number,
  visit: (rowid: number, payload: Uint8Array) => void,
  countOnly = false,
): number {
  const base = (pageNo - 1) * db.pageSize;
  const hdr = base + (pageNo === 1 ? 100 : 0);
  const type = db.view.getUint8(hdr);
  const cellCount = db.view.getUint16(hdr + 3);
  const ptrArray = hdr + (type === 2 || type === 5 ? 12 : 8);
  let rows = 0;
  if (type === 5) {
    // Interior table page: cells are (left child, key); the rightmost
    // child pointer sits in the header.
    for (let i = 0; i < cellCount; i++) {
      const cell = base + db.view.getUint16(ptrArray + i * 2);
      rows += walkTable(db, db.view.getUint32(cell), visit, countOnly);
    }
    rows += walkTable(db, db.view.getUint32(hdr + 8), visit, countOnly);
  } else if (type === 13) {
    // Leaf table page: cells are (payload length, rowid, payload).
    for (let i = 0; i < cellCount; i++) {
      const cell = base + db.view.getUint16(ptrArray + i * 2);
      const [len, p1] = varint(db.view, cell);
      const [rowid, p2] = varint(db.view, p1);
      if (countOnly) rows += 1;
      else visit(rowid, readPayload(db, p2, len));
    }
  } else {
    throw new Error(
      `corrupt SQLite file (page ${String(pageNo)} is not a table b-tree page)`,
    );
  }
  return rows;
}

function countRows(db: Db, rootpage: number): number {
  return walkTable(db, rootpage, () => {}, true);
}

/** Whether a root page is a table b-tree (5/13), not an index one. */
function rootIsTableBtree(db: Db, pageNo: number): boolean {
  const base = (pageNo - 1) * db.pageSize;
  const type = db.view.getUint8(base + (pageNo === 1 ? 100 : 0));
  return type === 5 || type === 13;
}

/* --- Records --- */

const INT_SIZES = [1, 2, 3, 4, 6, 8];

/**
 * A record: a varint header of serial types, then the values. Returns
 * null for NULL, number for integers/floats/0/1, string for text,
 * Uint8Array for blobs.
 */
function decodeRecord(db: Db, payload: Uint8Array): unknown[] {
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const [headerLen, h] = varint(view, 0);
  const serials: number[] = [];
  let p = h;
  while (p < headerLen) {
    const [s, next] = varint(view, p);
    serials.push(s);
    p = next;
  }
  const values: unknown[] = [];
  let body = headerLen;
  for (const s of serials) {
    if (s === 0) values.push(null);
    else if (s >= 1 && s <= 6) {
      const size = INT_SIZES[s - 1] ?? 8;
      values.push(signedInt(view, body, size));
      body += size;
    } else if (s === 7) {
      values.push(view.getFloat64(body));
      body += 8;
    } else if (s === 8) values.push(0);
    else if (s === 9) values.push(1);
    else if (s === 10 || s === 11) {
      throw new Error("corrupt SQLite file (reserved serial type)");
    } else if (s % 2 === 0) {
      const n = (s - 12) / 2;
      values.push(payload.subarray(body, body + n));
      body += n;
    } else {
      const n = (s - 13) / 2;
      values.push(db.decoder.decode(payload.subarray(body, body + n)));
      body += n;
    }
  }
  return values;
}

/* --- The schema table (sqlite_master, rooted at page 1) --- */

interface SchemaTable {
  name: string;
  rootpage: number;
  sql: string;
  parsed?: { columns: SqliteColumnInfo[]; rowidAlias: number };
}

/**
 * Tool bookkeeping tables (leading underscore - litestream's
 * `_litestream_seq` / `_litestream_lock` ride along in any file it
 * replicated). They are flagged `internal`, never hidden:
 * "I can't see my table" beats tidy. `sqlite_*` is different - SQLite
 * reserves that prefix, so no user table can start with it.
 */
function isInternalTable(name: string): boolean {
  return name.startsWith("_");
}

function readSchema(db: Db): SchemaTable[] {
  const out: SchemaTable[] = [];
  walkTable(db, 1, (_rowid, payload) => {
    const [type, name, , rootpage, sql] = decodeRecord(db, payload);
    if (type !== "table" || typeof name !== "string" || typeof sql !== "string")
      return;
    if (name.startsWith("sqlite_")) return;
    out.push({
      name,
      rootpage: typeof rootpage === "number" ? rootpage : 0,
      sql,
    });
  });
  return out;
}

/** Parse the CREATE TABLE once, caching it on the schema entry. */
function parseSchemaTable(table: SchemaTable): {
  columns: SqliteColumnInfo[];
  rowidAlias: number;
} {
  if (!table.parsed) table.parsed = parseCreateTable(table.sql, table.name);
  return table.parsed;
}

/** The first token of a column definition, honouring quoting. */
function firstToken(s: string): { raw: string; name: string } {
  const ch = s[0] ?? "";
  if (ch === '"' || ch === "`" || ch === "[") {
    const end = ch === "[" ? "]" : ch;
    let name = "";
    let i = 1;
    while (i < s.length) {
      if (s[i] === end) {
        if (end !== "]" && s[i + 1] === end) {
          name += end;
          i += 2;
          continue;
        }
        return { raw: s.slice(0, i + 1), name };
      }
      name += s[i];
      i++;
    }
    return { raw: s, name };
  }
  const m = /^[^\s(]+/.exec(s);
  const raw = m?.[0] ?? "";
  return { raw, name: raw };
}

/** Split on commas that are not inside parens or quotes. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i] ?? "";
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = ch;
      i++;
      while (i < body.length && (body[i] !== end || body[i + 1] === end)) i++;
      i++;
      continue;
    }
    if (ch === "[") {
      while (i < body.length && body[i] !== "]") i++;
      i++;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  parts.push(body.slice(start));
  return parts;
}

const TABLE_CONSTRAINTS = new Set([
  "CONSTRAINT",
  "PRIMARY",
  "UNIQUE",
  "CHECK",
  "FOREIGN",
]);

/**
 * Column names and declared types from a CREATE TABLE statement.
 * Table-level constraints are skipped; WITHOUT ROWID tables and
 * generated columns are a clear error (different storage).
 */
function parseCreateTable(
  sql: string,
  tableName: string,
): { columns: SqliteColumnInfo[]; rowidAlias: number } {
  const open = sql.indexOf("(");
  if (open < 0) {
    throw new Error(`cannot read the definition of table "${tableName}"`);
  }
  let depth = 0;
  let close = -1;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i] ?? "";
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = ch;
      i++;
      while (i < sql.length && (sql[i] !== end || sql[i + 1] === end)) i++;
      continue;
    }
    if (ch === "[") {
      while (i < sql.length && sql[i] !== "]") i++;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) {
    throw new Error(`cannot read the definition of table "${tableName}"`);
  }
  if (/WITHOUT\s+ROWID/i.test(sql.slice(close + 1))) {
    throw new Error(
      `table "${tableName}" is WITHOUT ROWID - folio reads ordinary tables only`,
    );
  }
  const columns: SqliteColumnInfo[] = [];
  let rowidAlias = -1;
  for (const part of splitTopLevel(sql.slice(open + 1, close))) {
    const def = part.trim();
    if (!def) continue;
    const first = firstToken(def);
    if (TABLE_CONSTRAINTS.has(first.name.toUpperCase())) continue;
    const decl = def.slice(first.raw.length).trim();
    if (/\bAS\b\s*\(/i.test(decl) || /GENERATED/i.test(decl)) {
      throw new Error(
        `table "${tableName}" has a generated column ("${first.name}") - not supported`,
      );
    }
    const col: SqliteColumnInfo = { name: first.name, decl };
    columns.push(col);
    // INTEGER PRIMARY KEY (not DESC) is an alias for the rowid: it is
    // stored as NULL in the record, its real value is the rowid.
    if (
      rowidAlias < 0 &&
      /^INTEGER\b/i.test(decl) &&
      /PRIMARY\s+KEY/i.test(decl) &&
      !/PRIMARY\s+KEY\s+DESC/i.test(decl)
    ) {
      rowidAlias = columns.length - 1;
    }
  }
  return { columns, rowidAlias };
}

/* --- Reading a table as import data --- */

function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (v instanceof Uint8Array) {
    let hex = "";
    for (const b of v) hex += b.toString(16).padStart(2, "0");
    return `0x${hex}`;
  }
  return String(v);
}

/**
 * The column's type from its declared type and its values: INTEGER and
 * REAL columns are numbers when the values are; TEXT columns are dates
 * when every value reads as one, else text - never coerced to numbers,
 * so identifiers like phone numbers keep their leading zeros; anything
 * else is inferred from the values (as CSV import infers).
 */
function columnType(
  decl: string,
  values: unknown[],
): ParsedImport["columns"][number]["type"] {
  const d = decl.toUpperCase();
  const filled = values.filter((v) => v !== null && v !== "");
  if (/INT/.test(d)) {
    return filled.every((v) => typeof v === "number") ? "number" : "text";
  }
  if (/REAL|FLOA|DOUB/.test(d)) {
    return filled.every((v) => typeof v === "number") ? "number" : "text";
  }
  if (/CHAR|CLOB|TEXT/.test(d)) {
    return looksLikeDates(filled) ? "date" : "text";
  }
  if (filled.every((v) => typeof v === "number")) return "number";
  if (looksLikeDates(filled)) return "date";
  return "text";
}

function readTable(
  db: Db,
  rootpage: number,
  schema: { columns: SqliteColumnInfo[]; rowidAlias: number },
): ParsedImport {
  const { columns: schemaCols, rowidAlias } = schema;
  const rawRows: unknown[][] = [];
  walkTable(db, rootpage, (rowid, payload) => {
    const values = decodeRecord(db, payload);
    if (rowidAlias >= 0 && values[rowidAlias] === null) {
      values[rowidAlias] = rowid;
    }
    rawRows.push(values);
  });
  const names = sanitizeNames(schemaCols.map((c) => c.name));
  const width = schemaCols.length;
  const columns = schemaCols.map((c, i) => ({
    name: names[i] ?? `col_${String(i + 1)}`,
    type: columnType(
      c.decl,
      rawRows.map((r) => r[i]),
    ),
  }));
  const rows: Cell[][] = rawRows.map((r) => {
    const out: Cell[] = [];
    for (let i = 0; i < width; i++) out.push(toCell(r[i]));
    return out;
  });
  // Date columns are written ISO, number columns carry actual numbers
  // (the model contract formulas and formats rely on).
  return applyTypes({ columns, rows });
}
