import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseDoc, serializeDoc } from "../../src/engine/doc";

/**
 * The in-app help (docs/specs/in-app-help.md): one folio document per
 * topic in demo/help/, listed by demo/help/index.md.
 */
describe("help topics", () => {
  const files = readdirSync("demo/help").filter((f) => f.endsWith(".md"));

  it("every topic round-trips byte for byte", () => {
    for (const f of files) {
      const s = readFileSync(`demo/help/${f}`, "utf8");
      expect(serializeDoc(parseDoc(s)) === s, f).toBe(true);
    }
  });

  it("the index lists every topic, and every listed topic exists", () => {
    const index = readFileSync("demo/help/index.md", "utf8");
    const listed = [...index.matchAll(/^- \[[^\]]+\]\(([\w-]+\.md)\)/gm)].map(
      (m) => m[1],
    );
    expect(new Set(listed)).toEqual(
      new Set(files.filter((f) => f !== "index.md")),
    );
  });
});
