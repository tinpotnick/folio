import { describe, expect, it } from "vitest";
import { meshToStl } from "@folio/render/stl";

describe("meshToStl", () => {
  it("writes an ASCII STL with a triangle fan per face, with normals", () => {
    const stl = meshToStl(
      [
        {
          vertices: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
          ],
        },
      ],
      "bracket",
    );
    expect(stl.startsWith("solid bracket\n")).toBe(true);
    expect(stl.trimEnd().endsWith("endsolid bracket")).toBe(true);
    expect(stl.match(/facet normal/g)).toHaveLength(2);
    expect(stl).toContain("facet normal 0 0 1");
    expect(stl.match(/vertex /g)).toHaveLength(6);
  });

  it("names are made safe for the header", () => {
    expect(meshToStl([], "my part!").startsWith("solid my_part_\n")).toBe(true);
  });
});
