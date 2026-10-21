import { describe, expect, it } from "vitest";
import { onlineSampleSources } from "@folio/audio/online-samples";

describe("onlineSampleSources", () => {
  it("finds a pattern's own internet sample banks", () => {
    expect(
      onlineSampleSources(
        "samples('github:tidalcycles/dirt-samples')\nstack(s(\"amencutup\"))",
      ),
    ).toEqual(["github:tidalcycles/dirt-samples"]);
    expect(
      onlineSampleSources(
        'samples({ bd: "bd.wav" }, "https://example.com/kit/")\nsamples(`shabda:piano`)',
      ),
    ).toEqual(["https://example.com/kit/", "shabda:piano"]);
  });

  it("ignores folio's own sounds, commented-out calls, and other strings", () => {
    expect(onlineSampleSources('s("bd sd").bank("tr808")')).toEqual([]);
    expect(
      onlineSampleSources("// samples('github:x/y')\nnote(\"c e g\")"),
    ).toEqual([]);
    expect(onlineSampleSources('note("https://not-a-sample")')).toEqual([]);
  });

  it("lists each source once", () => {
    expect(
      onlineSampleSources("samples('github:a/b')\nsamples('github:a/b')"),
    ).toEqual(["github:a/b"]);
  });
});
