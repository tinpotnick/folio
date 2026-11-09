/**
 * Motion figures (spec: docs/specs/motion-figures.md): a frame
 * sequence rendered as static SVG frame groups. The open document
 * plays the sequence (the host swaps group visibility - no SMIL, no
 * script inside the SVG, so output stays sanitized and printable);
 * print shows a designed static rendition (filmstrip / flowmap /
 * poster / frame:N) chosen by the block's display/print keys.
 *
 * Frames are ordinary table rows: the time axis is a COLUMN in long
 * format (frame, agent, x, y ...), never a nested structure. A
 * built-in seeded murmuration sim generates frames when no source table is
 * given; the seed makes every render and every PDF identical.
 */
import type { Cell, Motion, Table } from "../engine/index.js";

export interface MotionPoint {
  id: string;
  x: number;
  y: number;
}

export interface MotionFrame {
  label: string;
  points: MotionPoint[];
}

export interface MotionEdge {
  from: string;
  to: string;
  qty: number;
  speed: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MotionData {
  width: number;
  height: number;
  frames: MotionFrame[];
  /** Flow only: the static graph the packets travel. */
  edges?: MotionEdge[];
  nodes?: { id: string; x: number; y: number }[];
}

export interface MotionStyle {
  ink?: string;
  muted?: string;
  accent?: string;
  paper?: string;
  colors?: string[];
}

/* --- deterministic PRNG: same seed, same swarm, same PDF --- */

export function mulberry32(a: number): () => number {
  let s = a | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- the built-in swarm sim (a wandering vortex murmuration) --- */

/**
 * Seeded murmuration: each bird orbits a slowly wandering attractor
 * with its own radius and angular speed (most swirling one way), a
 * radial wobble makes the cloud breathe, and a little noise keeps it
 * organic - the recognizable swirling swallow-flock shape, not a loose
 * scatter, and it never settles into a static equilibrium. Pure and
 * deterministic (mulberry32): two runs with the same seed produce
 * byte-identical frames (unit-tested). The demo example documents the
 * same model in Python, so a generated @frames table and the built-in
 * sim look alike.
 */
export function murmurationSim(opts: {
  seed?: number;
  agents?: number;
  frames?: number;
  width?: number;
  height?: number;
}): MotionData {
  const W = opts.width ?? 640;
  const H = opts.height ?? 360;
  const N = Math.max(1, opts.agents ?? 120);
  const F = Math.max(1, opts.frames ?? 90);
  const rand = mulberry32(opts.seed ?? 1);
  const birds = Array.from({ length: N }, (_, i) => ({
    r0: 10 + Math.pow(rand(), 1.8) * 100,
    w: (0.1 + (rand() * 0.06 - 0.03)) * (i % 4 === 0 ? -1 : 1),
    th: rand() * Math.PI * 2,
    ph: rand() * Math.PI * 2,
    sq: 0.55 + rand() * 0.4,
  }));
  const frames: MotionFrame[] = [];
  for (let f = 0; f < F; f++) {
    const ax = W / 2 + Math.sin(f * 0.03) * W * 0.22;
    const ay = H / 2 + Math.cos(f * 0.042) * H * 0.18;
    const rot = f * 0.028;
    frames.push({
      label: String(f),
      points: birds.map((b, i) => {
        const r = b.r0 * (1 + 0.38 * Math.sin(f * 0.23 + b.ph));
        const th = b.th + b.w * f + rot;
        return {
          id: `a${String(i)}`,
          x: ax + r * Math.cos(th) + (rand() * 5 - 2.5),
          y: ay + r * Math.sin(th) * b.sq + (rand() * 5 - 2.5),
        };
      }),
    });
  }
  return { width: W, height: H, frames };
}

/* --- frames from a dataset (the time axis is a column) --- */

function colIndex(table: Table, name: string): number {
  const i = table.columns.findIndex((c) => c.name === name);
  if (i < 0)
    throw new Error(`Motion figure: unknown column '${name}' in @${table.id}`);
  return i;
}

function numCell(v: Cell | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize x/y data into the view box with padding. */
function fitBounds(
  points: { x: number; y: number }[],
  W: number,
  H: number,
): { sx: (x: number) => number; sy: (y: number) => number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 24;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = pad + (W - pad * 2 - spanX * scale) / 2;
  const oy = pad + (H - pad * 2 - spanY * scale) / 2;
  return {
    sx: (x) => ox + (x - minX) * scale,
    sy: (y) => oy + (y - minY) * scale,
  };
}

/** Swarm frames from a table: group rows by the time column. */
export function swarmFromTable(table: Table, motion: Motion): MotionData {
  const W = motion.width ?? 640;
  const H = motion.height ?? 360;
  const tCol = colIndex(table, motion.time ?? "frame");
  const iCol = colIndex(table, motion.idCol ?? "agent");
  const xCol = colIndex(table, motion.xCol ?? "x");
  const yCol = colIndex(table, motion.yCol ?? "y");
  const rows = [...table.rows].sort(
    (a, b) =>
      numCell(a[tCol]) - numCell(b[tCol]) ||
      String(a[iCol]).localeCompare(String(b[iCol])),
  );
  const allPts = rows.map((r) => ({
    x: numCell(r[xCol]),
    y: numCell(r[yCol]),
  }));
  const fit = fitBounds(allPts, W, H);
  const byFrame = new Map<string, MotionPoint[]>();
  for (const r of rows) {
    const key = String(r[tCol] ?? "");
    const arr = byFrame.get(key) ?? [];
    arr.push({
      id: String(r[iCol] ?? ""),
      x: fit.sx(numCell(r[xCol])),
      y: fit.sy(numCell(r[yCol])),
    });
    byFrame.set(key, arr);
  }
  const frames: MotionFrame[] = [...byFrame.entries()].map(
    ([label, points]) => ({
      label,
      points,
    }),
  );
  if (!frames.length)
    throw new Error(`Motion figure: @${table.id} has no rows`);
  return { width: W, height: H, frames };
}

/** Flow from an edge-list table; nodes laid out on a circle (deterministic). */
export function flowFromTable(table: Table, motion: Motion): MotionData {
  const W = motion.width ?? 640;
  const H = motion.height ?? 360;
  const fCol = colIndex(table, motion.fromCol ?? "from");
  const tCol = colIndex(table, motion.toCol ?? "to");
  const qCol = table.columns.findIndex(
    (c) => c.name === (motion.qtyCol ?? "qty"),
  );
  const sCol = table.columns.findIndex(
    (c) => c.name === (motion.speedCol ?? "speed"),
  );
  const timeCol = table.columns.findIndex(
    (c) => c.name === (motion.time ?? "frame"),
  );
  const nodeIds: string[] = [];
  for (const r of table.rows) {
    for (const v of [String(r[fCol] ?? ""), String(r[tCol] ?? "")]) {
      if (!nodeIds.includes(v)) nodeIds.push(v);
    }
  }
  const R = Math.min(W, H) / 2 - 36;
  const nodes = nodeIds.map((id, i) => {
    const a = (i / nodeIds.length) * Math.PI * 2 - Math.PI / 2;
    return { id, x: W / 2 + R * Math.cos(a), y: H / 2 + R * Math.sin(a) };
  });
  const pos = new Map(nodes.map((n) => [n.id, n] as const));
  const edges: MotionEdge[] = table.rows.map((r) => {
    const from = String(r[fCol] ?? "");
    const to = String(r[tCol] ?? "");
    const p1 = pos.get(from);
    const p2 = pos.get(to);
    if (!p1 || !p2)
      throw new Error(`Motion figure: edge '${from}' -> '${to}' has no layout`);
    return {
      from,
      to,
      qty: qCol >= 0 ? numCell(r[qCol]) : 1,
      speed: sCol >= 0 ? numCell(r[sCol]) || 1 : 1,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
    };
  });
  // Frames: distinct time values when the table has a time column,
  // else `frames` (default 60) synthetic ticks.
  const F =
    timeCol >= 0
      ? new Set(table.rows.map((r) => String(r[timeCol] ?? ""))).size
      : Math.max(1, motion.frames ?? 60);
  const frames: MotionFrame[] = [];
  for (let f = 0; f < F; f++) {
    const points: MotionPoint[] = [];
    edges.forEach((e, ei) => {
      const n = Math.min(8, Math.max(1, Math.round(e.qty)));
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
      for (let k = 0; k < n; k++) {
        const t = ((f * e.speed) / (len * 12) + k / n) % 1;
        points.push({
          id: `e${String(ei)}p${String(k)}`,
          x: e.x1 + (e.x2 - e.x1) * t,
          y: e.y1 + (e.y2 - e.y1) * t,
        });
      }
    });
    frames.push({ label: String(f), points });
  }
  return { width: W, height: H, frames, edges, nodes };
}

/* --- renditions --- */

export type Rendition =
  | { kind: "player" }
  | { kind: "filmstrip" }
  | { kind: "flowmap" }
  | { kind: "trails" }
  | { kind: "poster" }
  | { kind: "frame"; n: number };

/** Parse a display/print value; unknown values are a visible error. */
export function parseRendition(
  s: string | undefined,
  fallback: string,
): Rendition {
  const v = (s ?? fallback).trim();
  if (
    v === "player" ||
    v === "filmstrip" ||
    v === "flowmap" ||
    v === "trails" ||
    v === "poster"
  ) {
    return { kind: v } as Rendition;
  }
  const m = /^frame:(\d+)$/.exec(v);
  if (m) return { kind: "frame", n: Number(m[1]) };
  throw new Error(
    `Motion figure: unknown rendition '${v}' (player | filmstrip | flowmap | trails | poster | frame:N)`,
  );
}

/** display defaults to the player; print defaults per type (swarm
 * filmstrip, flow flowmap) - both overridable per block. A still PDF
 * cannot play, so print: player maps to the filmstrip. */
export function renditionsOf(motion: Motion): {
  display: Rendition;
  print: Rendition;
} {
  // flowmap needs a flow layout - asking for it on a swarm is a
  // visible error, not a blank figure.
  const check = (r: Rendition): Rendition => {
    if (r.kind === "flowmap" && motion.type !== "flow") {
      throw new Error(
        "flowmap is a flow-figure rendition - a swarm has no edges",
      );
    }
    return r;
  };
  const print = parseRendition(
    motion.print,
    motion.type === "flow" ? "flowmap" : "filmstrip",
  );
  return {
    display: check(parseRendition(motion.display, "player")),
    print: check(print.kind === "player" ? { kind: "filmstrip" } : print),
  };
}

/* --- SVG builders --- */

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function frameGroup(
  frame: MotionFrame,
  i: number,
  style: MotionStyle,
  r: number,
  next?: MotionFrame,
): string {
  const fill = style.accent ?? "#2b5d94";
  const nextPos = new Map((next?.points ?? []).map((p) => [p.id, p] as const));
  const pts = frame.points
    .map((p) => {
      // Orient each bird along its actual motion (displacement to the
      // next frame) - a flock of swallows in flight, not random arrows.
      const n = nextPos.get(p.id);
      const dvx = n ? n.x - p.x : 0;
      const dvy = n ? n.y - p.y : 0;
      const a =
        n && (dvx !== 0 || dvy !== 0)
          ? Math.atan2(dvy, dvx)
          : ((Number(p.id.replace(/\D/g, "")) || 0) % 628) / 100;
      const deg = (a * 180) / Math.PI;
      // A swept-wing chevron reads as a bird.
      const d = `M 0 0 L ${(-1.5 * r).toFixed(1)} ${(0.8 * r).toFixed(1)} L ${(-0.6 * r).toFixed(1)} 0 L ${(-1.5 * r).toFixed(1)} ${(-0.8 * r).toFixed(1)} Z`;
      return `<path class="mpoint" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${deg.toFixed(1)})" d="${d}" fill="${fill}"><title>${esc(`${p.id} @ ${frame.label}`)}</title></path>`;
    })
    .join("");
  return `<g class="mframe" data-i="${String(i)}">${pts}</g>`;
}

/** The flow graph underlay (edges + labeled nodes), shared by the
 * player and the trails rendition. */
function graphSvg(data: MotionData, style: MotionStyle): string {
  const ink = style.ink ?? "#1f2328";
  const edges =
    data.edges
      ?.map((e) => {
        const w = Math.min(6, 0.8 + e.qty * 0.8);
        return `<line x1="${e.x1.toFixed(1)}" y1="${e.y1.toFixed(1)}" x2="${e.x2.toFixed(1)}" y2="${e.y2.toFixed(1)}" stroke="${style.muted ?? "#8b949e"}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
      })
      .join("") ?? "";
  const nodes =
    data.nodes
      ?.map(
        (n) =>
          `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="4" fill="${ink}"/><text x="${(n.x + 8).toFixed(1)}" y="${(n.y + 4).toFixed(1)}" font-size="11" fill="${style.muted ?? "#57606a"}">${esc(n.id)}</text>`,
      )
      .join("") ?? "";
  return edges + nodes;
}

/** The player SVG: one viewBox, every frame as a group (the host shows
 * one at a time; print renditions use the same frames). */
export function playerSvg(data: MotionData, style: MotionStyle = {}): string {
  const graph = graphSvg(data, style);
  const frames = data.frames
    // The last frame orients toward the first, matching the loop.
    .map((f, i) =>
      frameGroup(
        f,
        i,
        style,
        data.edges ? 3 : 4.5,
        data.frames[(i + 1) % data.frames.length],
      ),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(data.width)} ${String(data.height)}" role="img" class="motion-player">${graph}${frames}</svg>`;
}

/** The trails rendition: one line per agent through every frame's
 * position, a small dot at each intermediate location, and a distinct
 * marker at the final one - movement readable at a glance in a still. */
export function trailsSvg(data: MotionData, style: MotionStyle = {}): string {
  const accent = style.accent ?? "#2b5d94";
  const muted = style.muted ?? "#8b949e";
  const paper = style.paper ?? "#ffffff";
  const byId = new Map<string, { x: number; y: number; f: number }[]>();
  data.frames.forEach((fr, fi) => {
    for (const p of fr.points) {
      const arr = byId.get(p.id) ?? [];
      arr.push({ x: p.x, y: p.y, f: fi });
      byId.set(p.id, arr);
    }
  });
  const parts: string[] = [graphSvg(data, style)];
  for (const [id, pts] of byId) {
    pts.sort((a, b) => a.f - b.f);
    const d = pts
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      )
      .join(" ");
    parts.push(
      `<path class="mtrail" d="${d}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.2"/>`,
    );
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      if (!p) continue;
      parts.push(
        `<circle class="mstep" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.6" fill="${muted}"/>`,
      );
    }
    const last = pts[pts.length - 1];
    if (last) {
      parts.push(
        `<circle class="mend" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.4" fill="${accent}" stroke="${paper}" stroke-width="1.2"><title>${esc(`${id} @ frame ${String(last.f)}`)}</title></circle>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(data.width)} ${String(data.height)}" role="img" class="motion-trails">${parts.join("")}</svg>`;
}

/** One thumbnail SVG per frame (the filmstrip rendition). */
export function filmstripSvg(
  data: MotionData,
  style: MotionStyle = {},
  maxThumbs = 12,
): string {
  const step = Math.max(1, Math.ceil(data.frames.length / maxThumbs));
  const thumbs: string[] = [];
  for (let i = 0; i < data.frames.length; i += step) {
    const f = data.frames[i];
    if (!f) continue;
    thumbs.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(data.width)} ${String(data.height)}" class="motion-thumb">${frameGroup(f, i, style, 6, data.frames[i + 1])}</svg>`,
    );
  }
  return thumbs.join("");
}

/** The aggregate flow map (flow's static rendition): edge width ~
 * total quantity, arrowheads, node labels. */
export function flowmapSvg(data: MotionData, style: MotionStyle = {}): string {
  if (!data.edges || !data.nodes)
    throw new Error("flowmap needs a flow layout");
  const ink = style.ink ?? "#1f2328";
  const muted = style.muted ?? "#57606a";
  const accent = style.accent ?? "#2b5d94";
  const total = data.edges.reduce((s, e) => s + e.qty, 0) || 1;
  const marker = `<defs><marker id="marrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" fill="${accent}"/></marker></defs>`;
  const edges = data.edges
    .map((e) => {
      const w = Math.max(1, (e.qty / total) * 40);
      const mx = (e.x1 + e.x2) / 2;
      const my = (e.y1 + e.y2) / 2;
      // shorten the line so the arrowhead lands on the node
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
      const ux = (e.x2 - e.x1) / len;
      const uy = (e.y2 - e.y1) / len;
      const x2 = e.x2 - ux * 8;
      const y2 = e.y2 - uy * 8;
      return `<line x1="${e.x1.toFixed(1)}" y1="${e.y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${accent}" stroke-width="${w.toFixed(1)}" marker-end="url(#marrow)" opacity="0.85"><title>${esc(`${e.from} → ${e.to}: ${String(e.qty)}`)}</title></line><text x="${mx.toFixed(1)}" y="${(my - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="${muted}">${esc(String(Math.round(e.qty)))}</text>`;
    })
    .join("");
  const nodes = data.nodes
    .map(
      (n) =>
        `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="5" fill="${ink}"/><text x="${n.x.toFixed(1)}" y="${(n.y + 18).toFixed(1)}" text-anchor="middle" font-size="11" fill="${ink}">${esc(n.id)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(data.width)} ${String(data.height)}" role="img" class="motion-flowmap">${marker}${edges}${nodes}</svg>`;
}

/** A single frame as a static SVG (poster / frame:N). */
export function frameSvg(
  data: MotionData,
  n: number,
  style: MotionStyle = {},
): string {
  const f = data.frames[n] ?? data.frames[0];
  if (!f) throw new Error("Motion figure: no frames");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(data.width)} ${String(data.height)}" role="img" class="motion-frame">${frameGroup(f, n, style, data.edges ? 3 : 4.5, data.frames[n + 1])}</svg>`;
}

/** Build the frame data for a motion block: built-in sim when no
 * source, else read the dataset (recalculated by the caller). */
export function motionData(motion: Motion, table?: Table): MotionData {
  if (motion.type === "flow") {
    if (!table) throw new Error("A flow figure needs a source: @edge-list");
    return flowFromTable(table, motion);
  }
  if (!table) return murmurationSim(motion);
  return swarmFromTable(table, motion);
}
