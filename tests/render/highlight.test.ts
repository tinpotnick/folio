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
