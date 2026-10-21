/**
 * A 3D mesh as a flat-shaded SVG (spec: docs/specs/jscad-blocks.md,
 * ADR-0020). Orthographic projection, back faces culled, painter's
 * order, one light from the viewer's upper left. Pure: no DOM, no
 * WebGL - the same drawing in Chromium, WebKitGTK and print, themed
 * like the charts.
 */

export type Vec3 = [number, number, number];

export interface MeshPolygon {
  vertices: Vec3[];
  /** RGBA 0..1 from the model (`colorize`); else the theme's fill. */
  color?: [number, number, number, number];
  /** Flat 2D shapes are visible from both sides. */
  twoSided?: boolean;
}

/** Degrees: yaw turns about the vertical (Z) axis, pitch tilts down. */
export interface MeshView {
  yaw: number;
  pitch: number;
}

export const VIEWS: Record<string, MeshView> = {
  iso: { yaw: -35, pitch: 28 },
  front: { yaw: 0, pitch: 0 },
  right: { yaw: -90, pitch: 0 },
  top: { yaw: 0, pitch: 90 },
};

/** More than this and the SVG becomes sluggish: say so instead. */
export const MAX_POLYGONS = 60000;

export interface MeshStyle {
  /** #rrggbb: the model's colour when it has none of its own. */
  fill: string;
  width?: number;
  height?: number;
}

function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m?.[1] ?? "8899aa";
  return [0, 2, 4].map((o) => parseInt(v.slice(o, o + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

const to255 = (x: number): number =>
  Math.max(0, Math.min(255, Math.round(x * 255)));

/**
 * Project and shade. Screen axes: x right, d INTO the screen, u up.
 * Front view looks along +Y with Z up; top view looks down -Z.
 */
export function meshToSvg(
  polygons: MeshPolygon[],
  view: MeshView,
  style: MeshStyle,
): string {
  if (polygons.length > MAX_POLYGONS) {
    throw new Error(
      `the model has ${String(polygons.length)} faces - too detailed to draw (limit ${String(MAX_POLYGONS)}); lower its segments`,
    );
  }
  const W = style.width ?? 640;
  const H = style.height ?? 400;
  const yaw = (view.yaw * Math.PI) / 180;
  const pitch = (view.pitch * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const project = ([x, y, z]: Vec3): Vec3 => {
    const xr = x * cy - y * sy;
    const yr = x * sy + y * cy;
    return [xr, yr * cp - z * sp, z * cp + yr * sp];
  };
  // Light FROM the viewer's upper left (x left, toward the viewer, up).
  const L = ((): Vec3 => {
    const v: Vec3 = [-0.45, -1, 0.75];
    const n = Math.hypot(...v);
    return [v[0] / n, v[1] / n, v[2] / n];
  })();
  const base = hexRgb(style.fill);

  type Face = { pts: Vec3[]; depth: number; rgb: [number, number, number] };
  const faces: Face[] = [];
  for (const poly of polygons) {
    if (poly.vertices.length < 3) continue;
    const pts = poly.vertices.map(project);
    const [a, b, c] = pts as [Vec3, Vec3, Vec3];
    const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: Vec3 = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(...n) || 1;
    n = [n[0] / len, n[1] / len, n[2] / len];
    // Edge-on faces have no area to show; faces turned away are
    // hidden unless two-sided. Facing the viewer: the normal points
    // back out of the screen (negative depth).
    if (Math.abs(n[1]) < 1e-6) continue;
    if (n[1] > 0) {
      if (!poly.twoSided) continue;
      n = [-n[0], -n[1], -n[2]];
    }
    const lambert = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const shade = 0.42 + 0.58 * lambert;
    const own = poly.color;
    const rgb: [number, number, number] = own
      ? [own[0] * shade, own[1] * shade, own[2] * shade]
      : [base[0] * shade, base[1] * shade, base[2] * shade];
    const depth = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    faces.push({ pts, depth, rgb });
  }
  if (faces.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(W)} ${String(H)}" role="img"></svg>`;
  }
  // Fit the drawing to the viewBox with a margin; screen y is -u.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const f of faces) {
    for (const p of f.pts) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, -p[2]);
      maxY = Math.max(maxY, -p[2]);
    }
  }
  const margin = 16;
  const scale = Math.min(
    (W - 2 * margin) / Math.max(maxX - minX, 1e-9),
    (H - 2 * margin) / Math.max(maxY - minY, 1e-9),
  );
  const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
  // Painter's order: far faces first.
  faces.sort((a, b) => b.depth - a.depth);
  const parts = faces.map((f) => {
    const d = f.pts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${(p[0] * scale + ox).toFixed(1)} ${(-p[2] * scale + oy).toFixed(1)}`,
      )
      .join("");
    const fill = `rgb(${String(to255(f.rgb[0]))},${String(to255(f.rgb[1]))},${String(to255(f.rgb[2]))})`;
    // The stroke in the face's own colour hides hairline seams.
    return `<path d="${d}Z" fill="${fill}" stroke="${fill}" stroke-width="1" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(W)} ${String(H)}" role="img">${parts.join("")}</svg>`;
}
