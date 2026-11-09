import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseDoc, serializeDoc } from "@folio/engine/doc";

for (const f of ["swarm.md", "flow.md"]) {
  it(`demo example ${f} round-trips byte-identically`, () => {
    const src = readFileSync(`demo/examples/${f}`, "utf8");
    expect(serializeDoc(parseDoc(src))).toBe(src);
  });
}
