import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc } from "@folio/engine/doc";
import type { Motion, Table } from "@folio/engine";
import {
  murmurationSim,
  filmstripSvg,
  fitNodeLayout,
  flowFromTable,
  flowmapSvg,
  frameSvg,
  motionData,
  mulberry32,
  parseRendition,
  trailsSvg,
  playerSvg,
  renditionsOf,
  swarmFromTable,
} from "@folio/render/motion";

describe("motion figures", () => {
  it("the seeded murmuration sim is deterministic: same seed, identical frames", () => {
    const a = murmurationSim({ seed: 7, agents: 20, frames: 10 });
    const b = murmurationSim({ seed: 7, agents: 20, frames: 10 });
    expect(a).toEqual(b);
    const c = murmurationSim({ seed: 8, agents: 20, frames: 10 });
    expect(a).not.toEqual(c);
    expect(a.frames).toHaveLength(10);
    expect(a.frames[0]?.points).toHaveLength(20);
  });

  it("mulberry32 is deterministic", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it("frames come from a table with the time axis as a plain column", () => {
    const table: Table = {
      id: "frames",
      columns: [
        { name: "frame", type: "number" },
        { name: "agent", type: "text" },
        { name: "x", type: "number" },
        { name: "y", type: "number" },
      ],
      rows: [
        [0, "A", 0, 0],
        [0, "B", 10, 10],
        [1, "A", 1, 0],
        [1, "B", 11, 10],
      ],
    };
    const motion: Motion = { type: "swarm", source: "frames" };
    const data = swarmFromTable(table, motion);
    expect(data.frames).toHaveLength(2);
    expect(data.frames[0]?.points).toHaveLength(2);
    const f0 = data.frames[0]?.points[0];
    const f1 = data.frames[1]?.points[0];
    expect(f0).toBeDefined();
    expect(f1).toBeDefined();
    // frame 1's bird A moved +1 in x after normalization
    expect((f1?.x ?? 0) - (f0?.x ?? 0)).toBeGreaterThan(0);
    // unknown column is a visible error
    expect(() =>
      swarmFromTable(table, { type: "swarm", source: "frames", xCol: "nope" }),
    ).toThrow(/unknown column/);
  });

  it("motionData: no source runs the built-in sim; flow needs a source", () => {
    const sim = motionData({ type: "swarm", seed: 3, agents: 5, frames: 4 });
    expect(sim.frames).toHaveLength(4);
    expect(() => motionData({ type: "flow" })).toThrow(/needs a source/);
  });

  it("the player SVG has one group per frame; filmstrip caps thumbs; flowmap aggregates", () => {
    const data = murmurationSim({ seed: 1, agents: 6, frames: 30 });
    const svg = playerSvg(data, { accent: "#2b5d94" });
    expect((svg.match(/class="mframe"/g) ?? []).length).toBe(30);
    // 30 frames, cap 12 -> step 3 -> 10 thumbs.
    expect(
      (filmstripSvg(data, {}, 12).match(/class="motion-thumb"/g) ?? []).length,
    ).toBe(10);
    expect(frameSvg(data, 5)).toContain('data-i="5"');

    const edges: Table = {
      id: "roads",
      columns: [
        { name: "from", type: "text" },
        { name: "to", type: "text" },
        { name: "qty", type: "number" },
      ],
      rows: [
        ["A", "B", 10],
        ["B", "C", 4],
      ],
    };
    const flow = flowFromTable(edges, { type: "flow", source: "roads" });
    expect(flow.edges).toHaveLength(2);
    expect(flow.nodes).toHaveLength(3);
    expect(flow.frames.length).toBeGreaterThan(0);
    const fm = flowmapSvg(flow, { accent: "#2b5d94" });
    expect(fm).toContain("A");
    expect(fm).toContain("marker-end");
  });

  it("trails: one path per agent through all frames, dots at intermediate stops, a marker at the end", () => {
    expect(parseRendition("trails", "player")).toEqual({ kind: "trails" });
    expect(renditionsOf({ type: "swarm", display: "trails" }).display).toEqual({
      kind: "trails",
    });
    const data = murmurationSim({ seed: 1, agents: 6, frames: 10 });
    const svg = trailsSvg(data, { accent: "#2b5d94" });
    expect(svg).toContain('class="motion-trails"');
    // one trail line per agent
    expect((svg.match(/class="mtrail"/g) ?? []).length).toBe(6);
    // 10 frames -> 9 intermediate dots + 1 end marker per agent
    expect((svg.match(/class="mstep"/g) ?? []).length).toBe(6 * 9);
    expect((svg.match(/class="mend"/g) ?? []).length).toBe(6);
    // the end marker sits at the agent's last frame position
    const last = data.frames[9]?.points[0];
    expect(last).toBeDefined();
    expect(svg).toContain(
      `cx="${(last?.x ?? 0).toFixed(1)}" cy="${(last?.y ?? 0).toFixed(1)}"`,
    );
    // a flow's trails draw the graph underneath
    const edges: Table = {
      id: "roads",
      columns: [
        { name: "from", type: "text" },
        { name: "to", type: "text" },
        { name: "qty", type: "number" },
      ],
      rows: [["A", "B", 10]],
    };
    const flow = flowFromTable(edges, { type: "flow", source: "roads" });
    expect(trailsSvg(flow, {})).toContain("<line");
  });

  it("renditions: defaults per type, print player maps to filmstrip, unknown is an error", () => {
    expect(renditionsOf({ type: "swarm" })).toEqual({
      display: { kind: "player" },
      print: { kind: "filmstrip" },
    });
    expect(renditionsOf({ type: "flow" }).print).toEqual({ kind: "flowmap" });
    expect(renditionsOf({ type: "swarm", print: "player" }).print).toEqual({
      kind: "filmstrip",
    });
    expect(
      renditionsOf({ type: "swarm", display: "frame:12" }).display,
    ).toEqual({
      kind: "frame",
      n: 12,
    });
    expect(() => parseRendition("weird", "player")).toThrow(
      /unknown rendition/,
    );
  });

  it("flowmap on a swarm is a visible error, not a blank figure", () => {
    expect(() => renditionsOf({ type: "swarm", display: "flowmap" })).toThrow(
      /flowmap is a flow-figure rendition/,
    );
    expect(() => renditionsOf({ type: "swarm", print: "flowmap" })).toThrow(
      /flowmap is a flow-figure rendition/,
    );
    // ...while a flow figure accepts it.
    expect(renditionsOf({ type: "flow", display: "flowmap" }).display).toEqual({
      kind: "flowmap",
    });
  });

  it("the motion directive round-trips byte-identically", () => {
    const src = `# T

::: motion {#flock}
type: swarm
source: @frames
time: frame
id: agent
x: x
y: y
seed: 7
agents: 120
frames: 90
display: player
print: filmstrip
caption: "A flock"
:::

::: motion {#roads-flow}
type: flow
source: @roads
qty: cars
print: flowmap
:::

::: motion {#map-flow}
type: flow
source: @roads
nodes: @places
:::

::: motion {#lr-flow}
type: flow
source: @roads
diagram: @net
:::
`;
    const doc = parseDoc(src);
    expect(serializeDoc(doc)).toBe(src);
    const m = doc.blocks[1];
    if (m?.kind !== "motion") throw new Error("not motion");
    expect(m.motion).toMatchObject({
      id: "flock",
      type: "swarm",
      source: "frames",
      time: "frame",
      idCol: "agent",
      seed: 7,
      agents: 120,
      frames: 90,
      display: "player",
      print: "filmstrip",
      caption: "A flock",
    });
  });

  it("unknown motion keys are a parse error", () => {
    expect(() =>
      parseDoc("# T\n\n::: motion {#m}\ntype: swarm\nbogus: 1\n:::\n"),
    ).toThrow(/Unknown motion key/);
    expect(() =>
      parseDoc("# T\n\n::: motion {#m}\ntype: vortex\n:::\n"),
    ).toThrow(/type: swarm or flow/);
  });

  it("nodes:/diagram: parse, and both together are a parse error", () => {
    const doc = parseDoc(
      "# T\n\n::: motion {#m}\ntype: flow\nsource: @r\nnodes: @p\n:::\n",
    );
    const b = doc.blocks[1];
    if (b?.kind !== "motion") throw new Error("not motion");
    expect(b.motion.nodes).toBe("p");
    expect(b.motion.diagram).toBeUndefined();
    expect(() =>
      parseDoc(
        "# T\n\n::: motion {#m}\ntype: flow\nsource: @r\nnodes: @p\ndiagram: @d\n:::\n",
      ),
    ).toThrow(/mutually exclusive/);
  });

  it("flowFromTable takes a nodes layout: raw positions, edgeless nodes kept, unknown edge endpoints are an error", () => {
    const edges: Table = {
      id: "roads",
      columns: [
        { name: "from", type: "text" },
        { name: "to", type: "text" },
        { name: "qty", type: "number" },
      ],
      rows: [["A", "B", 4]],
    };
    const layout = [
      { id: "A", x: 10, y: 20 },
      { id: "B", x: 110, y: 20 },
      { id: "C", x: 60, y: 300 }, // no edges - still drawn
    ];
    const data = flowFromTable(
      edges,
      { type: "flow", source: "roads" },
      layout,
    );
    expect(data.nodes).toHaveLength(3);
    expect(data.nodes?.[0]).toEqual({ id: "A", x: 10, y: 20 });
    expect(data.edges?.[0]).toMatchObject({ x1: 10, y1: 20, x2: 110, y2: 20 });
    expect(() =>
      flowFromTable(
        { ...edges, rows: [["A", "Z", 1]] },
        { type: "flow", source: "roads" },
        layout,
      ),
    ).toThrow(/no layout/);
    // no layout -> circle fallback still works
    const circ = flowFromTable(edges, { type: "flow", source: "roads" });
    expect(circ.nodes).toHaveLength(2);
  });

  it("fitNodeLayout rescales a foreign coordinate space into the viewBox, preserving aspect", () => {
    const fitted = fitNodeLayout(
      [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1000, y: 500 },
      ],
      640,
      360,
    );
    const xs = fitted.map((n) => n.x);
    const ys = fitted.map((n) => n.y);
    // spans the padded viewBox, not beyond it
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(24);
    expect(Math.max(...xs)).toBeLessThanOrEqual(640 - 24);
    expect(Math.max(...ys)).toBeLessThanOrEqual(360 - 24);
    // aspect preserved: 1000:500 = 2:1 span ratio
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(spanX / spanY).toBeCloseTo(2, 1);
  });
});
