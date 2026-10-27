/**
 * folio document model + engine.
 * Pure computation, zero UI dependencies (ADR-0001, ADR-0007).
 * Every public function here is a machine-checkable contract.
 */
export const engineVersion = "0.0.1";

export type ColumnType =
  "text" | "number" | "date" | "select" | "formula" | "relation";

export interface Column {
  name: string;
  type: ColumnType;
  unit?: string;
  format?: "percent" | "currency";
  expr?: string;
  width?: number;
  align?: "left" | "right";
}

export type Cell = string | number;

export interface Table {
  id: string;
  caption?: string;
  // Import provenance (ADR-0005: snapshot + metadata): the file or
  // web address a past import materialized this table's data from.
  // Never a live binding - Refresh fetches again only when asked.
  import?: string;
  /** When a web import was fetched (ISO date). */
  retrieved?: string;
  /** The bibliography key that cites this data's source. */
  cite?: string;
  columns: Column[];
  rows: Cell[][];
  /**
   * Present when this is a SIMPLE table (spec: docs/specs/
   * simple-tables.md): a standard GitHub pipe table, stored as one.
   * Cells are text exactly as written; `align` is the delimiter
   * row's per-column alignment. Absent: a dataset (`::: table`).
   */
  simple?: {
    align: TableAlign[];
    /** The table's source lines as written, and a signature of the
     * content they encode: while the content is unchanged the
     * author's own formatting is re-emitted verbatim. */
    raw?: string;
    sig?: string;
  };
}

export type TableAlign = "none" | "left" | "right" | "center";

export interface Document {
  version: 1;
  frontmatter: Record<string, unknown>;
  blocks: Block[];
}

export interface Block {
  kind:
    "prose" | "heading" | "table" | "chart" | "diagram" | "callout" | "image";
  id: string;
  data: Table | Chart | Record<string, never>;
}

export interface Image {
  id: string; // directive anchor, e.g. ops-photo
  // A data URI (offline-safe, single file) or an external URL /
  // path (rendered opportunistically - never a render dependency).
  src: string;
  alt?: string;
  caption?: string;
}

/** Embedded audio - the media sibling of Image: a recorded sound,
 * played by the native <audio> element (no execution, no engine).
 * Same src contract: a data URI is offline-safe; an external URL
 * or path renders opportunistically, never as a dependency. */
export interface Audio {
  id: string; // directive anchor, e.g. interview-clip
  src: string;
  alt?: string;
  caption?: string;
}

export interface Chart {
  id?: string; // directive anchor, e.g. growth-chart
  source: string; // table id
  query: {
    select: string[];
    // A Jexl boolean expression per row ("q2 > 400 and region == 'North'")
    // or the legacy {column, op, value} triple - both round-trip.
    filter?: string | { column: string; op: string; value: Cell };
    sort?: { by: string; order: "asc" | "desc" };
  };
  type: "bar" | "line" | "area" | "pie" | "donut" | "scatter";
  /** Split the value into one series per distinct value of this
   * column (long tables). */
  series?: string;
  /** Stack the series (bar, area) instead of grouping/overlapping. */
  stack?: boolean;
  caption?: string;
}
