/**
 * Refresh imported data from a file (docs/specs/data-import.md,
 * "Refresh from a file"): the table keeps its identity - id, caption,
 * licence, citation, window - and takes the picked file's current
 * columns and rows; `import:` moves to the new file. Pure engine code,
 * zero UI dependencies.
 */
import type { Table } from "./index.js";
import { splitImportOrigin, type ParsedImport } from "./ingest.js";

export interface RefreshTarget {
  id: string;
  /** The provenance recorded now. */
  from: string;
  /** The provenance after the refresh (the picked file, `#table` for
   * a table inside a SQLite file). */
  to: string;
}

/**
 * The "same source, newer file" family: digit runs collapse, so
 * `cdr_2026_01.db` and `cdr_2026_02.db` are one family and
 * `sales-2026-01.csv` matches `sales-2026-02.csv`.
 */
function familyOf(file: string): string {
  return file.toLowerCase().replace(/\d+/g, "*");
}

/**
 * Which of the document's imported tables a picked file refreshes:
 * a table matches when its recorded source names the picked file
 * exactly, or a file in the same family (a newer month, a new
 * version). A SQLite table (`file.db#cdr`) matches only when the
 * picked file is a database holding that table. Web addresses are not
 * refreshed by a file - fetching again is a separate, future command.
 */
export function matchRefreshTargets(
  tables: { id: string; import?: string | undefined }[],
  pickedFile: string,
  pickedTables: string[],
): RefreshTarget[] {
  const pickedLower = pickedTables.map((t) => t.toLowerCase());
  const out: RefreshTarget[] = [];
  for (const t of tables) {
    if (!t.import || /^https?:\/\//i.test(t.import)) continue;
    const { file, table } = splitImportOrigin(t.import);
    if (table === undefined) {
      if (file === pickedFile) {
        out.push({ id: t.id, from: t.import, to: pickedFile });
      }
      continue;
    }
    if (!pickedLower.includes(table.toLowerCase())) continue;
    if (file === pickedFile || familyOf(file) === familyOf(pickedFile)) {
      out.push({ id: t.id, from: t.import, to: `${pickedFile}#${table}` });
    }
  }
  return out;
}

/**
 * The table after a refresh: the new data, everything else kept. A
 * column keeps its display settings (unit, format, width, align) when
 * the new file has a column of the same name; formula columns the
 * author added are kept and recalculate over the new rows.
 */
export function refreshedTable(
  table: Table,
  parsed: ParsedImport,
  to: string,
  today: string,
): Table {
  const oldByName = new Map(
    table.columns.map((c) => [c.name.toLowerCase(), c] as const),
  );
  const formulaCols = table.columns.filter(
    (c) => c.type === "formula" || c.expr !== undefined,
  );
  const columns: Table["columns"] = parsed.columns.map((c) => {
    const old = oldByName.get(c.name.toLowerCase());
    if (!old) return c;
    return {
      ...c,
      ...(old.unit !== undefined ? { unit: old.unit } : {}),
      ...(old.format !== undefined ? { format: old.format } : {}),
      ...(old.width !== undefined ? { width: old.width } : {}),
      ...(old.align !== undefined ? { align: old.align } : {}),
    };
  });
  columns.push(...formulaCols);
  const width = columns.length;
  const rows = parsed.rows.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
  return {
    ...table,
    columns,
    rows,
    import: to,
    ...(table.retrieved !== undefined ? { retrieved: today } : {}),
  };
}
