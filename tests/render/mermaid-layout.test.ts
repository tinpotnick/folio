// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { nodeCentersFromMermaidSvg } from "@folio/render/mermaid-layout";

/** A trimmed mermaid 12 flowchart SVG: node group ids carry the
 * render id prefix ("folio-layout-net-flowchart-Market-0"), and
 * flowchart rects are centred on the translate origin. */
const FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" style="max-width: 300px">
  <g class="edgePaths"><path d="M 90 40 L 210 40" class="edge"/></g>
  <g class="node default" id="folio-layout-net-flowchart-Market-0" transform="translate(50,40)">
    <rect class="basic label-container" x="-76" y="-24" width="152" height="48" rx="4"/>
    <text x="0" y="6">Market</text>
  </g>
  <g class="node default" id="folio-layout-net-flowchart-Square-1" transform="translate(250,40)">
    <rect class="basic label-container" x="-76" y="-24" width="152" height="48" rx="4"/>
    <text x="0" y="6">Square</text>
  </g>
</svg>`;

describe("mermaid layout extraction", () => {
  it("reads node centres from flowchart groups (render-id-prefixed, rect centred on translate)", () => {
    const nodes = nodeCentersFromMermaidSvg(FIXTURE);
    expect(nodes).toHaveLength(2);
    expect(nodes).toContainEqual({ id: "Market", x: 50, y: 40 });
    expect(nodes).toContainEqual({ id: "Square", x: 250, y: 40 });
  });

  it("off-origin rects offset the centre; circle nodes use cx/cy; non-node groups are ignored", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g class="node" id="flowchart-A-0" transform="translate(12,20)">
        <rect x="0" y="0" width="76" height="40"/>
      </g>
      <g class="node" id="flowchart-Dock-3" transform="translate(5,6)">
        <circle cx="20" cy="15" r="15"/>
      </g>
      <g class="cluster" id="cluster-x"><rect width="10" height="10"/></g>
    </svg>`;
    expect(nodeCentersFromMermaidSvg(svg)).toEqual([
      { id: "A", x: 12 + 38, y: 20 + 20 },
      { id: "Dock", x: 25, y: 21 },
    ]);
  });

  it("a diagram with no flowchart nodes yields an empty layout (caller errors visibly)", () => {
    expect(
      nodeCentersFromMermaidSvg(
        `<svg xmlns="http://www.w3.org/2000/svg"><g id="note-1"><rect width="5" height="5"/></g></svg>`,
      ),
    ).toEqual([]);
  });

  it("unparseable SVG throws", () => {
    expect(() => nodeCentersFromMermaidSvg("<svg><g")).toThrow(/did not parse/);
  });
});
