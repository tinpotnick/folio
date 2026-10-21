/**
 * A 3D mesh as a flat-shaded SVG (spec: docs/specs/jscad-blocks.md,
 * ADR-0020). Orthographic projection, back faces culled, painter's
 * order, one light from the viewer's upper left. Pure: no DOM, no
 * WebGL - the same drawing in Chromium, WebKitGTK and print, themed
 * like the charts. Faces paint in an exact back-to-front order from a
 * BSP tree (built once per mesh).
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

/**
 * Up to this many faces the painting order is EXACT (a BSP tree,
 * built once in about 0.3 s at the limit). A BSP over a large smooth
 * solid costs O(n^2) to build - and a smooth convex shape barely
 * needs ordering (culling alone draws it right) - so above the
 * limit faces are sorted by their centre's depth instead.
 */
export const EXACT_ORDER_LIMIT = 2500;

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

/* --- Exact back-to-front order: a BSP tree ---
 * Sorting faces by their centre's depth fails where a long face sits
 * partly behind a small one (gear teeth, the walls of a hole). A BSP
 * tree splits faces by each other's planes so that, for ANY view, a
 * walk visiting the far side of each plane first paints in a correct
 * order. Built once per mesh; turning the model only re-walks it. */

interface Plane {
  n: Vec3;
  w: number;
}

interface BspNode {
  plane: Plane;
  faces: MeshPolygon[];
  front: BspNode | null;
  back: BspNode | null;
}

const EPS = 1e-5;

/** The plane of a face (Newell's method: robust for any convex face). */
function planeOf(p: MeshPolygon): Plane | null {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const vs = p.vertices;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i] as Vec3;
    const b = vs[(i + 1) % vs.length] as Vec3;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return null;
  const n: Vec3 = [nx / len, ny / len, nz / len];
  const v0 = vs[0] as Vec3;
  return { n, w: n[0] * v0[0] + n[1] * v0[1] + n[2] * v0[2] };
}

/** Split a convex face by a plane into its front and back parts. */
function splitFace(
  p: MeshPolygon,
  plane: Plane,
  coplanar: MeshPolygon[],
  front: MeshPolygon[],
  back: MeshPolygon[],
): void {
  const dist = p.vertices.map(
    (v) => plane.n[0] * v[0] + plane.n[1] * v[1] + plane.n[2] * v[2] - plane.w,
  );
  let types = 0;
  const kinds = dist.map((d) => (d < -EPS ? 2 : d > EPS ? 1 : 0));
  for (const k of kinds) types |= k;
  if (types === 0) {
    coplanar.push(p);
    return;
  }
  if (types === 1) {
    front.push(p);
    return;
  }
  if (types === 2) {
    back.push(p);
    return;
  }
  const f: Vec3[] = [];
  const b: Vec3[] = [];
  const vs = p.vertices;
  for (let i = 0; i < vs.length; i++) {
    const j = (i + 1) % vs.length;
    const ki = kinds[i] ?? 0;
    const kj = kinds[j] ?? 0;
    const vi = vs[i] as Vec3;
    const vj = vs[j] as Vec3;
    if (ki !== 2) f.push(vi);
    if (ki !== 1) b.push(vi);
    if ((ki | kj) === 3) {
      const di = dist[i] ?? 0;
      const dj = dist[j] ?? 0;
      const t = di / (di - dj);
      const cut: Vec3 = [
        vi[0] + (vj[0] - vi[0]) * t,
        vi[1] + (vj[1] - vi[1]) * t,
        vi[2] + (vj[2] - vi[2]) * t,
      ];
      f.push(cut);
      b.push(cut);
    }
  }
  if (f.length >= 3) front.push({ ...p, vertices: f });
  if (b.length >= 3) back.push({ ...p, vertices: b });
}

function buildBsp(faces: MeshPolygon[]): BspNode | null {
  const usable = faces.filter((f) => planeOf(f) !== null);
  const first = usable[0];
  if (!first) return null;
  const root = makeNode(first);
  const jobs: { node: BspNode; faces: MeshPolygon[] }[] = [
    { node: root, faces: usable.slice(1) },
  ];
  for (let job = jobs.pop(); job; job = jobs.pop()) {
    const fronts: MeshPolygon[] = [];
    const backs: MeshPolygon[] = [];
    for (const f of job.faces) {
      splitFace(f, job.node.plane, job.node.faces, fronts, backs);
    }
    const nf = fronts[0];
    if (nf) {
      job.node.front = makeNode(nf);
      jobs.push({ node: job.node.front, faces: fronts.slice(1) });
    }
    const nb = backs[0];
    if (nb) {
      job.node.back = makeNode(nb);
      jobs.push({ node: job.node.back, faces: backs.slice(1) });
    }
  }
  return root;
}

function makeNode(face: MeshPolygon): BspNode {
  return {
    plane: planeOf(face) ?? { n: [0, 0, 1], w: 0 },
    faces: [face],
    front: null,
    back: null,
  };
}

/** Faces in painting order (far first) for viewing direction `into`. */
function backToFront(root: BspNode | null, into: Vec3): MeshPolygon[] {
  const out: MeshPolygon[] = [];
  // An explicit stack: [node, phase] - 0 = expand, 1 = emit the node.
  const stack: [BspNode, number][] = root ? [[root, 0]] : [];
  while (stack.length > 0) {
    const [node, phase] = stack.pop() as [BspNode, number];
    if (phase === 1) {
      out.push(...node.faces);
      continue;
    }
    const n = node.plane.n;
    // The viewer is on the FRONT side when the normal faces it.
    const viewerInFront = n[0] * into[0] + n[1] * into[1] + n[2] * into[2] < 0;
    const far = viewerInFront ? node.back : node.front;
    const near = viewerInFront ? node.front : node.back;
    // Pushed in reverse: far subtree, then this node, then near.
    if (near) stack.push([near, 0]);
    stack.push([node, 1]);
    if (far) stack.push([far, 0]);
  }
  return out;
}

const bspCache = new WeakMap<MeshPolygon[], BspNode | null>();

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

  type Face = { pts: Vec3[]; rgb: [number, number, number] };
  const faces: Face[] = [];
  // The viewing direction INTO the screen, in model space.
  const into: Vec3 = [sy * cp, cy * cp, -sp];
  let ordered: MeshPolygon[];
  if (polygons.length <= EXACT_ORDER_LIMIT) {
    let tree = bspCache.get(polygons);
    if (tree === undefined) {
      tree = buildBsp(polygons);
      bspCache.set(polygons, tree);
    }
    ordered = backToFront(tree, into);
  } else {
    const depth = (p: MeshPolygon): number =>
      p.vertices.reduce(
        (s, v) => s + v[0] * into[0] + v[1] * into[1] + v[2] * into[2],
        0,
      ) / p.vertices.length;
    ordered = [...polygons].sort((a, b) => depth(b) - depth(a));
  }
  for (const poly of ordered) {
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
    faces.push({ pts, rgb });
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
  // Already in painting order (far first): the BSP walk above.
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
