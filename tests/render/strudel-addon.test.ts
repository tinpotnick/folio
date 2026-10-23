import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STRUDEL_FILES, STRUDEL_VERSION } from "../../src/audio/strudel-addon";

describe("the Strudel add-on pin (ADR-0026)", () => {
  it("the pinned hashes are the release folio is tested against", () => {
    const pkg = JSON.parse(
      readFileSync("node_modules/@strudel/web/package.json", "utf8"),
    ) as { version: string };
    expect(pkg.version).toBe(STRUDEL_VERSION);
    for (const f of Object.values(STRUDEL_FILES)) {
      const text = readFileSync(`node_modules/@strudel/web/dist/${f.path}`);
      expect(createHash("sha256").update(text).digest("hex")).toBe(f.sha256);
    }
  });

  it("the module still finds its clock beside itself (the loader patches it)", () => {
    const mod = readFileSync(
      `node_modules/@strudel/web/dist/${STRUDEL_FILES.module.path}`,
      "utf8",
    );
    expect(mod).toContain(
      `new URL("${STRUDEL_FILES.clock.path}", import.meta.url)`,
    );
  });
});
