/**
 * A drawn model as an ASCII STL file (spec: docs/specs/
 * jscad-blocks.md, "Export STL"): each (convex) face becomes a fan
 * of triangles with its normal. Pure; units are the model's own.
 */
import type { MeshPolygon, Vec3 } from "./mesh-svg.js";

const num = (v: number): string => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? "0" : String(r);
};

function normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(...n) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

export function meshToStl(polygons: MeshPolygon[], name: string): string {
  const safe = name.replace(/[^\w.-]/g, "_") || "model";
  const out: string[] = [`solid ${safe}`];
  for (const p of polygons) {
    const [a, ...rest] = p.vertices;
    if (!a) continue;
    for (let i = 0; i + 1 < rest.length; i++) {
      const b = rest[i] as Vec3;
      const c = rest[i + 1] as Vec3;
      const n = normal(a, b, c);
      out.push(
        `  facet normal ${n.map(num).join(" ")}`,
        "    outer loop",
        ...[a, b, c].map((v) => `      vertex ${v.map(num).join(" ")}`),
        "    endloop",
        "  endfacet",
      );
    }
  }
  out.push(`endsolid ${safe}`);
  return out.join("\n") + "\n";
}
