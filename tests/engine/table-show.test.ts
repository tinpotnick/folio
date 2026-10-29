import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc } from "../../src/engine/doc";

/** A table's own row window (docs/specs/dataset-browser.md). */
describe("table show:", () => {
  const doc = (show: string) =>
    `# T\n\n::: table {#t}\ncaption: "T"\n${show}columns:\n  - {name: a, type: number}\ndata:\n  - [1]\n  - [2]\n:::\n`;

  it("round-trips a count, all, and its absence", () => {
    for (const show of ["show: 12\n", "show: all\n", ""]) {
      const src = doc(show);
      expect(serializeDoc(parseDoc(src))).toBe(src);
    }
  });

  it("reads into the model", () => {
    const t = (src: string) => {
      const b = parseDoc(src).blocks[1];
      return b?.kind === "table" ? b.table.show : null;
    };
    expect(t(doc("show: 12\n"))).toBe(12);
    expect(t(doc("show: all\n"))).toBe("all");
    expect(t(doc(""))).toBeUndefined();
  });

  it("a bad value is an error naming the table", () => {
    for (const bad of ["show: 0\n", "show: lots\n", "show: 2.5\n"]) {
      expect(() => parseDoc(doc(bad))).toThrow(/table 't': show must be/);
    }
  });
});
