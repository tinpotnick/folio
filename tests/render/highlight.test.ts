import { describe, expect, it } from "vitest";
import { highlightMarkdown } from "@folio/render/highlight";

function kinds(src: string): string[] {
  return highlightMarkdown(src).flatMap((l) => l.tokens.map((t) => t.kind));
}

function texts(src: string): string[] {
  return highlightMarkdown(src).flatMap((l) => l.tokens.map((t) => t.text));
}

describe("highlightMarkdown", () => {
  it("round-trips: concatenated token text equals the source", () => {
    const src = [
      "---",
      "theme: corporate-report",
      "style:",
      "  h1.font.size: 28pt",
      "---",
      "# Title",
      "",
      "Some **bold** and *italic* and `code`.",
      "  - {name: region, type: text}",
      "::: table {#t}",
      'caption: "A table"',
      "  - [a, 1]",
      ":::",
    ].join("\n");
    const rebuilt = highlightMarkdown(src)
      .map((l) => l.tokens.map((t) => t.text).join(""))
      .join("\n");
    expect(rebuilt).toBe(src);
  });

  it("classifies headings, bold, italic, code, bullets", () => {
    expect(kinds("# Hello")).toEqual(["heading"]);
    expect(kinds("**b**")).toEqual(["bold"]);
    expect(kinds("*i*")).toEqual(["italic"]);
    expect(kinds("`c`")).toEqual(["code"]);
    expect(kinds("- item")).toEqual(["bullet", "text"]);
  });

  it("classifies frontmatter delimiters and keys", () => {
    const toks = highlightMarkdown("---\ntheme: x\n---\n# T\n");
    expect(toks[0]?.tokens[0]?.kind).toBe("frontmatter-delim");
    expect(toks[1]?.tokens[0]?.kind).toBe("frontmatter-key");
    expect(toks[2]?.tokens[0]?.kind).toBe("frontmatter-delim");
    expect(toks[3]?.tokens[0]?.kind).toBe("heading");
  });

  it("classifies directive headers, keys, and list items", () => {
    const toks = highlightMarkdown(
      '::: table {#t}\ncaption: "c"\n  - [a, 1]\n:::\n',
    );
    expect(toks[0]?.tokens[0]?.kind).toBe("directive");
    expect(toks[1]?.tokens[1]?.kind).toBe("directive-key");
    expect(toks[2]?.tokens[0]?.kind).toBe("directive-list");
    expect(toks[3]?.tokens[0]?.kind).toBe("directive");
  });

  it("does not treat a mid-document --- as frontmatter", () => {
    expect(kinds("# T\n---\nprose")[2]).toBe("text");
  });

  it("keeps plain text untouched", () => {
    expect(texts("just words")).toEqual(["just words"]);
  });

  it("emits a giant line (a data: URL) unscanned, with the URI as a data token", () => {
    // per-character inline scanning on a multi-MB line costs seconds
    // on every keystroke in the source view - cap it
    const big = "src: data:image/png;base64," + "A".repeat(200_000);
    const line = highlightMarkdown(big)[0];
    // prefix + data token, never inline-scanned; round-trip holds
    expect(line?.tokens.map((t) => t.kind)).toEqual(["text", "data"]);
    expect(line?.tokens.map((t) => t.text).join("")).toBe(big);
    // a bold marker inside the giant line is NOT picked up...
    const big2 = "x".repeat(9000) + "**b**";
    expect(highlightMarkdown(big2)[0]?.tokens).toHaveLength(1);
    // ...but normal lines still get inline highlighting
    expect(kinds("a **b** c")).toEqual(["text", "bold", "text"]);
  });
});

describe("markdown+ token kinds", () => {
  it("classifies strikethrough and underline", () => {
    expect(kinds("~~gone~~")).toEqual(["strike"]);
    expect(kinds("++added++")).toEqual(["underline"]);
  });

  it("classifies a $$ math block, delimiters and content", () => {
    expect(kinds("$$\nE = mc^2\n$$")).toEqual(["math", "math", "math"]);
  });

  it("resumes prose highlighting after the closing $$", () => {
    expect(kinds("$$\nx\n$$\nplain text")[3]).toBe("text");
  });
});

describe("sub/sup tokens", () => {
  it("classifies subscript and superscript", () => {
    const kinds = (s: string) =>
      highlightMarkdown(s)[0]?.tokens.map((t) => t.kind) ?? [];
    expect(kinds("H~2~O")).toEqual(["text", "sub", "text"]);
    expect(kinds("x^2^")).toEqual(["text", "sup"]);
    expect(kinds("~~gone~~")).toEqual(["strike"]);
  });
});

describe("data-URI tokens", () => {
  const payload = "A".repeat(500);
  it("splits a long base64 data URI into a data token, keeping the full text", () => {
    const src = `::: audio {#a}\nsrc: data:audio/ogg;base64,${payload}\n:::`;
    const lines = highlightMarkdown(src);
    const kinds = lines[1]?.tokens.map((t) => t.kind) ?? [];
    expect(kinds).toEqual(["text", "directive-key", "text", "data"]);
    // round-trip: concatenated token text equals the source line
    const rebuilt = lines
      .map((l) => l.tokens.map((t) => t.text).join(""))
      .join("\n");
    expect(rebuilt).toBe(src);
    const dataTok = lines[1]?.tokens.find((t) => t.kind === "data");
    expect(dataTok?.text).toBe(`data:audio/ogg;base64,${payload}`);
  });

  it("leaves short data URIs inline", () => {
    const src = `src: data:image/png;base64,${"A".repeat(20)}`;
    const toks = highlightMarkdown(src)[0]?.tokens ?? [];
    expect(toks.some((t) => t.kind === "data")).toBe(false);
    expect(toks.map((t) => t.text).join("")).toBe(src);
  });

  it("chips an inline image data URI in prose too", () => {
    const src = `before ![pic](data:image/png;base64,${payload}) after`;
    const toks = highlightMarkdown(src)[0]?.tokens ?? [];
    expect(toks.some((t) => t.kind === "data")).toBe(true);
    expect(toks.map((t) => t.text).join("")).toBe(src);
  });
});
