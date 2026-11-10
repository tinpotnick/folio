/**
 * Layout extraction for flow figures that take their geometry from a
 * mermaid diagram block (spec: docs/specs/flow-geometry.md). Mermaid
 * is the layout engine; the edge TABLE stays the source of truth for
 * data. This module only reads node positions out of mermaid's
 * rendered SVG - it never interprets mermaid's text syntax.
 *
 * Mermaid (flowchart/graph) emits one group per node:
 *   <g class="node" id="<renderId>-flowchart-<id>-<n>"
 *      transform="translate(x,y)">
 *     <rect x=.. y=.. width=.. height=../>   (or circle / polygon)
 * The node's centre is the shape's centre offset by the translate
 * (flowchart rects are centred on the origin, so usually just the
 * translate point). Ids must be simple (letters/digits/dash/
 * underscore): mermaid rewrites anything else, and the edge table
 * must match.
 */

export interface NodePos {
  id: string;
  x: number;
  y: number;
}

/** Node centres from a mermaid flowchart/graph SVG. Returns [] when
 * no flowchart nodes were found (wrong diagram type) - the caller
 * turns that into a visible error. */
export function nodeCentersFromMermaidSvg(svg: string): NodePos[] {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("mermaid layout: rendered SVG did not parse");
  }
  const out: NodePos[] = [];
  for (const g of Array.from(doc.querySelectorAll("g.node"))) {
    // Mermaid prefixes the render id: "<renderId>-flowchart-<id>-<n>".
    const m = /flowchart-(.+)-\d+$/.exec(g.getAttribute("id") ?? "");
    if (!m) continue;
    const t = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(
      g.getAttribute("transform") ?? "",
    );
    const tx = t ? Number(t[1]) : 0;
    const ty = t ? Number(t[2]) : 0;
    let cx = tx;
    let cy = ty;
    const rect = g.querySelector("rect");
    const circle = g.querySelector("circle");
    if (rect) {
      cx =
        tx +
        Number(rect.getAttribute("x") ?? 0) +
        Number(rect.getAttribute("width") ?? 0) / 2;
      cy =
        ty +
        Number(rect.getAttribute("y") ?? 0) +
        Number(rect.getAttribute("height") ?? 0) / 2;
    } else if (circle) {
      cx = tx + Number(circle.getAttribute("cx") ?? 0);
      cy = ty + Number(circle.getAttribute("cy") ?? 0);
    }
    out.push({ id: m[1] ?? "", x: cx, y: cy });
  }
  return out;
}

/** The viewBox size of a rendered mermaid SVG - diagram-laid-out flow
 * figures adopt it as their own width/height, so frames, renditions
 * and the base diagram share one coordinate space. */
export function mermaidViewBox(svg: string): { w: number; h: number } {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const vb = doc.querySelector("svg")?.getAttribute("viewBox") ?? "";
  const m = /(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(vb);
  if (!m) throw new Error("mermaid layout: rendered SVG has no viewBox");
  return { w: Number(m[3]), h: Number(m[4]) };
}
