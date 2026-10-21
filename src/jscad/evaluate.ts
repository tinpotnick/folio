/**
 * Run a JSCAD script and return its faces (spec: docs/specs/
 * jscad-blocks.md). Pure apart from running the script itself - which
 * folio only ever does inside the sandboxed worker (ADR-0020).
 *
 * Accepts the forms JSCAD's own examples use:
 * `require('@jscad/modeling')`, `module.exports = { main,
 * getParameterDefinitions }` (parameter defaults go to `main`), or a
 * plain top-level `function main()`. `main` returns a shape or an
 * array of shapes: 3D solids draw as they are; 2D shapes draw as a
 * flat face.
 */
import type * as Modeling from "@jscad/modeling";
import type { MeshPolygon, Vec3 } from "../render/mesh-svg.js";

type ModelingApi = typeof Modeling;

interface ParamDef {
  name?: string;
  initial?: unknown;
  default?: unknown;
  checked?: unknown;
}

export function evaluateJscad(
  source: string,
  modeling: ModelingApi,
): MeshPolygon[] {
  const module = { exports: {} as Record<string, unknown> };
  const require = (name: string): unknown => {
    if (name === "@jscad/modeling") return modeling;
    throw new Error(
      `require('${name}'): only '@jscad/modeling' is available in folio`,
    );
  };
  // The script's own scope: CommonJS-style globals, and its top-level
  // `main` / `getParameterDefinitions` when it does not export them.
  const run = new Function(
    "require",
    "module",
    "exports",
    `${source}
;return {
  main: module.exports.main ?? (typeof main === "function" ? main : undefined),
  params: module.exports.getParameterDefinitions ??
    (typeof getParameterDefinitions === "function" ? getParameterDefinitions : undefined),
};`,
  ) as (
    r: typeof require,
    m: typeof module,
    e: Record<string, unknown>,
  ) => { main?: unknown; params?: unknown };
  const found = run(require, module, module.exports);
  if (typeof found.main !== "function") {
    throw new Error(
      "no main() - a JSCAD script defines main() and returns its shapes",
    );
  }
  const defaults: Record<string, unknown> = {};
  if (typeof found.params === "function") {
    for (const d of (found.params as () => ParamDef[])() ?? []) {
      if (d.name) defaults[d.name] = d.initial ?? d.default ?? d.checked;
    }
  }
  const result = (found.main as (p: Record<string, unknown>) => unknown)(
    defaults,
  );
  const shapes = (Array.isArray(result) ? result : [result]).flat(
    Infinity,
  ) as unknown[];
  const { geom2, geom3 } = modeling.geometries;
  const polys: MeshPolygon[] = [];
  for (const shape of shapes) {
    const color = (shape as { color?: [number, number, number, number] }).color;
    if (geom3.isA(shape as never)) {
      for (const p of geom3.toPolygons(shape as never)) {
        polys.push({
          vertices: (p as { vertices: Vec3[] }).vertices,
          ...(color ? { color } : {}),
        });
      }
    } else if (geom2.isA(shape as never)) {
      for (const outline of geom2.toOutlines(shape as never)) {
        polys.push({
          vertices: (outline as [number, number][]).map(([x, y]): Vec3 => [
            x,
            y,
            0,
          ]),
          twoSided: true,
          ...(color ? { color } : {}),
        });
      }
    }
  }
  if (polys.length === 0) {
    throw new Error(
      "main() returned no shapes - return a 3D solid, a 2D shape, or an array of them",
    );
  }
  return polys;
}
