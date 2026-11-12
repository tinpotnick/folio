/**
 * folio document model + engine.
 * Pure computation, zero UI dependencies (ADR-0001, ADR-0007).
 * Every public function here is a machine-checkable contract.
 */
export const engineVersion = "0.0.1";

export type ColumnType =
  "text" | "number" | "date" | "datetime" | "select" | "formula" | "relation";

export interface Column {
  name: string;
  type: ColumnType;
  unit?: string;
  format?: "percent" | "currency";
  expr?: string;
  width?: number;
  align?: "left" | "right";
  /**
   * Select columns (spec: docs/specs/select-columns.md): the closed
   * option list. Absent on other types.
   */
  options?: string[];
  /** Select columns only: multi-select (cell holds a comma-separated
   * list of options, rendered as one chip per value). */
  multi?: boolean;
  /**
   * Render-time only (spec: docs/specs/table-inspector.md): a hidden
   * column is not drawn in the table figure, but stays in the
   * document's data - formulas, charts, filters and the dataset
   * browser all still see it. Wide imports (a CDR's uuid,
   * transcription) hide their noise without losing anything.
   */
  hidden?: boolean;
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
  /** The terms the data came under: a licence's name, or
   * "personal-use" for data whose terms do not allow sharing. */
  licence?: string;
  /** How many rows the table shows in the page (spec: docs/specs/
   * dataset-browser.md, "Rows shown"): a count, or "all". Absent: the
   * document's `table.rows.show`. The data is never cut - charts,
   * formulas and the dataset browser see every row. */
  show?: number | "all";
  /**
   * Made by a script, not typed (spec: docs/specs/compute-blocks.md,
   * ADR-0030): the language that produced it ("python"). A computed
   * table is the SNAPSHOT of a compute block's output, stored right
   * after the block (ADR-0005) and not shown on the page; charts,
   * formulas and the dataset browser read it like any table.
   */
  computed?: string;
  /**
   * A single named value (`::: value {#slope}`), not a table: one
   * column `value`, one row. A formula reads it bare, `@slope`.
   */
  value?: true;
  columns: Column[];
  rows: Cell[][];
  /**
   * Derived totals row (spec: docs/specs/table-totals.md), rendered as
   * the table's footer. NOT data: charts, formulas and queries never
   * see it - it is computed from the recalculated rows at render
   * time. Each entry names a column and a Jexl expr evaluated with
   * the whole table as `self` (e.g. `self.col.amount | sum()`).
   */
  totals?: { col: string; expr: string }[];
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
    /**
     * Grouped query (spec: docs/specs/chart-rendering.md, "Grouped
     * queries"): group rows by these columns IN ORDER - by a, then b -
     * one output row per combination, in first-appearance order.
     * Output columns are the group columns then the agg names;
     * `select` is derived, not written. Without `group`, `select`
     * picks source columns.
     */
    group?: string[];
    /**
     * Aggregates for a grouped query: output name -> "fn" or
     * "fn(column)", fn one of count, sum, avg, min, max. `count`
     * alone counts rows; with a column, its non-empty cells.
     */
    agg?: Record<string, string>;
    /** Keep only the first N output rows (after sort). */
    limit?: number;
  };
  type: "bar" | "line" | "area" | "pie" | "donut" | "scatter" | "heatmap";
  /** Cross-filtering (spec: docs/specs/cross-filtering.md): charts
   * sharing a source are linked unless this is false. */
  crossfilter?: boolean;
  /** Split the value into one series per distinct value of this
   * column (long tables). */
  series?: string;
  /** Stack the series (bar, area) instead of grouping/overlapping. */
  stack?: boolean;
  caption?: string;
}

/**
 * A motion figure (spec: docs/specs/motion-figures.md): a frame
 * sequence rendered as SVG groups; the open document plays it, print
 * shows a designed static rendition. Frames are ordinary table rows -
 * the time axis is a COLUMN (long format), never a nested structure.
 */
export interface Motion {
  id?: string;
  type: "swarm" | "flow";
  /** Dataset of frames (swarm: frame/id/x/y rows) or edges (flow:
   * from/to/qty/speed rows). Absent on swarm: a built-in seeded sim.
   * Flow figures lay nodes out on a circle; to animate inside a
   * mermaid diagram, put `flow=@edges` on the mermaid block instead
   * (spec: docs/specs/flow-geometry.md). */
  source?: string;
  /** The frame/time column name (default "frame"). Any column can
   * play this role - it is chosen here, not baked into the model. */
  time?: string;
  /** Column mapping, per type (defaults shown). */
  idCol?: string; // swarm: "agent"
  xCol?: string; // swarm: "x"
  yCol?: string; // swarm: "y"
  fromCol?: string; // flow: "from"
  toCol?: string; // flow: "to"
  qtyCol?: string; // flow: "qty"
  speedCol?: string; // flow: "speed"
  /** Built-in swarm sim (no source): deterministic seeded vortex murmuration. */
  seed?: number; // 1
  agents?: number; // 120
  frames?: number; // 90
  width?: number; // 640
  height?: number; // 360
  /** In-document rendition: "player" (default) | "filmstrip" |
   * "flowmap" (flow) | "poster" | "frame:N". */
  display?: string;
  /** Print/PDF rendition, same vocabulary. Defaults: swarm
   * "filmstrip", flow "flowmap". */
  print?: string;
  caption?: string;
}
