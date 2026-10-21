import { describe, expect, it } from "vitest";
import {
  MAX_POLYGONS,
  VIEWS,
  meshToSvg,
  type MeshPolygon,
  type MeshView,
  type Vec3,
} from "@folio/render/mesh-svg";

/** An axis-aligned cube from -1..1, faces wound outward (CCW). */
function cube(): MeshPolygon[] {
  const f = (vs: Vec3[]): MeshPolygon => ({ vertices: vs });
  return [
    f([
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
    ]), // -x
    f([
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [1, -1, 1],
    ]), // +x
    f([
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ]), // -y (front)
    f([
      [-1, 1, -1],
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
    ]), // +y
    f([
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
      [1, -1, -1],
    ]), // -z
    f([
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ]), // +z (top)
  ];
}

function view(name: string): MeshView {
  const v = VIEWS[name];
  if (!v) throw new Error(`no view ${name}`);
  return v;
}

function face0(): MeshPolygon {
  const f = cube()[0];
  if (!f) throw new Error("empty cube");
  return f;
}

const paths = (svg: string): string[] => svg.match(/<path [^>]*\/>/g) ?? [];

describe("meshToSvg", () => {
  it("front view draws only the face toward the viewer", () => {
    expect(
      paths(meshToSvg(cube(), view("front"), { fill: "#3366cc" })),
    ).toHaveLength(1);
  });

  it("iso view draws exactly the three visible faces, differently shaded", () => {
    const svg = meshToSvg(cube(), view("iso"), { fill: "#3366cc" });
    const p = paths(svg);
    expect(p).toHaveLength(3);
    const fills = new Set(p.map((x) => /fill="([^"]+)"/.exec(x)?.[1]));
    expect(fills.size).toBe(3);
  });

  it("top view sees the top face", () => {
    expect(
      paths(meshToSvg(cube(), view("top"), { fill: "#3366cc" })),
    ).toHaveLength(1);
  });

  it("the drawing fits the viewBox with a margin", () => {
    const svg = meshToSvg(cube(), view("iso"), {
      fill: "#3366cc",
      width: 640,
      height: 400,
    });
    const nums = [...svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    for (const [x, y] of nums) {
      expect(x).toBeGreaterThanOrEqual(15);
      expect(x).toBeLessThanOrEqual(625);
      expect(y).toBeGreaterThanOrEqual(15);
      expect(y).toBeLessThanOrEqual(385);
    }
  });

  it("a model's own colour wins over the theme fill", () => {
    const red = cube().map((p) => ({
      ...p,
      color: [1, 0, 0, 1] as [number, number, number, number],
    }));
    const svg = meshToSvg(red, view("front"), { fill: "#3366cc" });
    const fill = /fill="rgb\((\d+),(\d+),(\d+)\)"/.exec(svg);
    expect(Number(fill?.[1])).toBeGreaterThan(0);
    expect(Number(fill?.[2])).toBe(0);
    expect(Number(fill?.[3])).toBe(0);
  });

  it("two-sided (2D) faces show from behind too", () => {
    const flat: MeshPolygon = {
      vertices: [
        [-1, -1, 0],
        [-1, 1, 0],
        [1, 1, 0],
        [1, -1, 0],
      ], // faces -z
      twoSided: true,
    };
    expect(
      paths(meshToSvg([flat], view("top"), { fill: "#3366cc" })),
    ).toHaveLength(1);
  });

  it("refuses a mesh too detailed to draw, and says how to fix it", () => {
    const many = Array.from({ length: MAX_POLYGONS + 1 }, () => face0());
    expect(() => meshToSvg(many, view("iso"), { fill: "#3366cc" })).toThrow(
      /lower its segments/,
    );
  });
});
