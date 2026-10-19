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
  columns: Column[];
  rows: Cell[][];
}

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
  caption?: string;
}
