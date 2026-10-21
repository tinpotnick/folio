import { describe, expect, it } from "vitest";
import * as modeling from "@jscad/modeling";
import { evaluateJscad } from "@folio/jscad/evaluate";

describe("evaluateJscad", () => {
  it("runs a standard JSCAD script (require + module.exports.main)", () => {
    const polys = evaluateJscad(
      `const { cuboid } = require('@jscad/modeling').primitives
       const main = () => cuboid({ size: [2, 2, 2] })
       module.exports = { main }`,
      modeling,
    );
    expect(polys).toHaveLength(6);
  });

  it("accepts a plain function main() and arrays of shapes", () => {
    const polys = evaluateJscad(
      `const { cuboid } = require('@jscad/modeling').primitives
       function main() {
         return [cuboid({ size: [1, 1, 1] }), cuboid({ size: [1, 1, 1], center: [3, 0, 0] })]
       }`,
      modeling,
    );
    expect(polys).toHaveLength(12);
  });

  it("passes the parameter defaults to main", () => {
    const polys = evaluateJscad(
      `const { cylinder } = require('@jscad/modeling').primitives
       const getParameterDefinitions = () => [
         { name: 'segments', type: 'int', initial: 8 },
       ]
       const main = (p) => cylinder({ radius: 1, height: 2, segments: p.segments })
       module.exports = { main, getParameterDefinitions }`,
      modeling,
    );
    // 8 sides + top + bottom fans (8 triangles each, or 2 polygons).
    expect(polys.length).toBeGreaterThanOrEqual(10);
  });

  it("keeps a shape's own colour", () => {
    const [first] = evaluateJscad(
      `const m = require('@jscad/modeling')
       const main = () => m.colors.colorize([1, 0, 0], m.primitives.cuboid())
       module.exports = { main }`,
      modeling,
    );
    expect(first?.color).toEqual([1, 0, 0, 1]);
  });

  it("draws a 2D shape as a flat, two-sided face", () => {
    const polys = evaluateJscad(
      `const { square } = require('@jscad/modeling').primitives
       const main = () => square({ size: 2 })
       module.exports = { main }`,
      modeling,
    );
    expect(polys).toHaveLength(1);
    expect(polys[0]?.twoSided).toBe(true);
  });

  it("explains what is missing or wrong", () => {
    expect(() => evaluateJscad("const x = 1", modeling)).toThrow(/main/);
    expect(() =>
      evaluateJscad(
        "const main = () => 42; module.exports = { main }",
        modeling,
      ),
    ).toThrow(/returned no shapes/);
    expect(() => evaluateJscad("require('fs')", modeling)).toThrow(
      /only '@jscad\/modeling'/,
    );
  });
});

describe("parameters from a dataset row", () => {
  it("row values override the parameter defaults, by name", () => {
    const src = `const { cylinder } = require('@jscad/modeling').primitives
      const getParameterDefinitions = () => [{ name: 'segments', initial: 8 }]
      const main = (p) => cylinder({ radius: 1, height: 1, segments: p.segments })
      module.exports = { main, getParameterDefinitions }`;
    const few = evaluateJscad(src, modeling);
    const many = evaluateJscad(src, modeling, { segments: 32 });
    expect(many.length).toBeGreaterThan(few.length);
  });
});
