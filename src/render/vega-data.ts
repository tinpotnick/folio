/**
 * Bind a Vega-Lite spec to folio datasets (spec: docs/specs/
 * drawn-blocks.md, "Vega-Lite"). Pure.
 *
 * Wherever the spec says `"data": {"name": "@table"}` (top level,
 * layers, concatenations ...), the dataset's rows are put in as
 * inline `values` - so the chart reads the live, recalculated table.
 * `"data": {"url": ...}` is refused: documents render offline.
 */

export type Rows = Record<string, unknown>[];

/** The @tables a spec reads (so a table edit can redraw it). */
export function vegaDataRefs(spec: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v === null || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const data = o["data"] as Record<string, unknown> | undefined;
    const name = data?.["name"];
    if (typeof name === "string" && name.startsWith("@")) {
      const id = name.slice(1);
      if (!out.includes(id)) out.push(id);
    }
    for (const child of Object.values(o)) walk(child);
  };
  walk(spec);
  return out;
}

/**
 * The spec with every `@table` data reference replaced by that
 * table's rows. Throws for an unknown table or a URL data source.
 */
export function bindVegaData(
  spec: unknown,
  lookup: (id: string) => Rows | undefined,
): unknown {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v === null || typeof v !== "object") return v;
    const o: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      o[k] = walk(child);
    }
    const data = o["data"] as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      if ("url" in data) {
        throw new Error(
          'data "url" is not allowed - folio documents render offline; use {"name": "@dataset"} or inline "values"',
        );
      }
      const name = data["name"];
      if (typeof name === "string" && name.startsWith("@")) {
        const rows = lookup(name.slice(1));
        if (!rows) {
          throw new Error(`no dataset ${name} - "name" must be @ a dataset id`);
        }
        const { name: _drop, ...rest } = data;
        void _drop;
        o["data"] = { ...rest, values: rows };
      }
    }
    return o;
  };
  return walk(spec);
}
