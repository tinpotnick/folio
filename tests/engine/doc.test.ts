import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDoc, ParseError, serializeDoc } from "@folio/engine/doc";
import { recalcTable } from "@folio/engine/recalc";

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), "..", "golden");

function loadGolden(name: string): string {
  return readFileSync(join(goldenDir, name), "utf8");
}

describe("round-trip identity (invariant #2)", () => {
  it("sample document: serialize(parse(text)) is byte-identical", () => {
    const text = loadGolden("sample-document.md");
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it("sample document: doc has frontmatter, headings, table, chart", () => {
    const doc = parseDoc(loadGolden("sample-document.md"));
    expect(doc.frontmatter.theme).toBe("corporate-report");
    expect(doc.frontmatter.style.length).toBeGreaterThan(0);
    const kinds = doc.blocks.map((b) => b.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("table");
    expect(kinds).toContain("chart");
    const table = doc.blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" && table.table.id).toBe(
      "regional-data",
    );
  });

  it("recalc on the parsed sample table produces expected growth values", () => {
    const doc = parseDoc(loadGolden("sample-document.md"));
    const tableBlock = doc.blocks.find((b) => b.kind === "table");
    if (tableBlock?.kind !== "table") throw new Error("no table block");
    const out = recalcTable(tableBlock.table);
    const expected = [(501 - 412) / 412, (394 - 388) / 388, (355 - 301) / 301];
    out.rows.forEach((row, i) => {
      expect(row[3]).toBeCloseTo(expected[i] ?? Number.NaN, 10);
    });
  });
});

describe("property: round-trip is stable (idempotence)", () => {
  it("re-serializing a parsed doc produces the same text every time", () => {
    const text = loadGolden("sample-document.md");
    const once = serializeDoc(parseDoc(text));
    const twice = serializeDoc(parseDoc(once));
    expect(twice).toBe(once);
  });

  it("docs with no frontmatter serialize without one", () => {
    const text = "# T\n\nSome prose.\n";
    const once = serializeDoc(parseDoc(text));
    expect(once.startsWith("# T")).toBe(true);
    expect(serializeDoc(parseDoc(once))).toBe(once);
  });

  it("a chart with a Jexl expression filter round-trips byte-identically", () => {
    const text =
      "# T\n\n::: chart {#c}\nsource: @t\nquery: {select: [region, q3], filter: \"q2 > 350 and region != 'South'\"}\ntype: bar\n:::\n";
    const once = serializeDoc(parseDoc(text));
    expect(once).toBe(text);
    expect(serializeDoc(parseDoc(once))).toBe(once);
    const chart = parseDoc(text).blocks.find((b) => b.kind === "chart");
    expect(
      chart && chart.kind === "chart" ? chart.chart.query.filter : null,
    ).toBe("q2 > 350 and region != 'South'");
  });

  it("a chart with the legacy triple filter round-trips as the triple", () => {
    const text =
      "# T\n\n::: chart {#c}\nsource: @t\nquery: {select: [region, q3], filter: {column: q2, op: gt, value: 400}}\ntype: bar\n:::\n";
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it("a chart filter string with escaped double quotes round-trips", () => {
    const doc = parseDoc(
      "# T\n\n::: chart {#c}\nsource: @t\nquery: {select: [region]}\ntype: bar\n:::\n",
    );
    const chart = doc.blocks.find((b) => b.kind === "chart");
    if (chart?.kind !== "chart") throw new Error("no chart");
    chart.chart.query.filter = 'region == "North"';
    const out = serializeDoc(doc);
    expect(out).toContain('filter: "region == \\"North\\""');
    expect(serializeDoc(parseDoc(out))).toBe(out);
  });

  it("empty paragraphs between content round-trip byte-identically", () => {
    // The serializer joins blocks with a blank line, so n empty
    // prose blocks emit 2n blank lines and parse back to n empties.
    const one = "# T\n\na\n\n\n\n## U\n";
    const two = "# T\n\na\n\n\n\n\n\n## U\n";
    expect(serializeDoc(parseDoc(one))).toBe(one);
    expect(serializeDoc(parseDoc(two))).toBe(two);
    const doc = parseDoc(two);
    const empties = doc.blocks.filter(
      (b) => b.kind === "prose" && b.text === "",
    );
    expect(empties.length).toBe(2);
  });

  it("math blocks parse and round-trip byte-identically", () => {
    const text = "# T\n\n$$\nE = mc^2\n$$\n";
    const doc = parseDoc(text);
    const block = doc.blocks.find((b) => b.kind === "math");
    expect(block && block.kind === "math" ? block.text : null).toBe("E = mc^2");
    expect(serializeDoc(doc)).toBe(text);
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it("an unterminated math block is a parse error", () => {
    expect(() => parseDoc("# T\n\n$$\nE = mc^2\n")).toThrow(
      /Unterminated math/,
    );
  });

  it("a prose paragraph does not swallow a following math block", () => {
    const doc = parseDoc("# T\n\nSome prose.\n$$\nx^2\n$$\n");
    const kinds = doc.blocks.map((b) => b.kind);
    expect(kinds).toEqual(["heading", "prose", "math"]);
  });

  it("leading and trailing blank runs stay separators, not empty blocks", () => {
    const text = "\n\n# T\n\nSome prose.\n\n\n";
    const once = serializeDoc(parseDoc(text));
    expect(once.startsWith("# T")).toBe(true);
    expect(
      parseDoc(once).blocks.filter((b) => b.kind === "prose" && b.text === "")
        .length,
    ).toBe(0);
  });
});

describe("error contracts", () => {
  it("throws ParseError on unterminated directive", () => {
    expect(() =>
      parseDoc("::: table {#t}\ncolumns:\n  - {name: a, type: text}\ndata:\n"),
    ).toThrow(/Unterminated directive/);
  });

  it("throws ParseError on unterminated frontmatter", () => {
    expect(() => parseDoc("---\ntheme: x\n")).toThrow(
      /Unterminated frontmatter/,
    );
  });

  it("throws on chart directive missing required keys", () => {
    expect(() => parseDoc('::: chart {#c}\ncaption: "x"\n:::\n')).toThrow(
      /missing source\/query\/type/,
    );
  });
});

describe("fenced code blocks", () => {
  it("parses and round-trips a fenced block with a language", () => {
    const src = "# Title\n\n```js\nconst x = 1;\nconst y = 2;\n```\n";
    const doc = parseDoc(src);
    expect(doc.blocks[1]).toEqual({
      kind: "code",
      lang: "js",
      text: "const x = 1;\nconst y = 2;",
    });
    expect(serializeDoc(doc)).toBe(src);
  });

  it("parses a fence without a language and round-trips", () => {
    const src = "```\nplain\n```\n";
    expect(serializeDoc(parseDoc(src))).toBe(src);
  });

  it("throws on an unterminated fence", () => {
    expect(() => parseDoc("```\nno end")).toThrow(ParseError);
  });
  it("parses and round-trips a strudel fence", () => {
    const src = '# T\n\n```strudel\nnote("c a f e")\n```\n';
    const doc = parseDoc(src);
    expect(doc.blocks[1]).toEqual({
      kind: "code",
      lang: "strudel",
      text: 'note("c a f e")',
    });
    expect(serializeDoc(doc)).toBe(src);
  });
});

describe("mermaid diagram blocks", () => {
  it("parses and round-trips a mermaid directive", () => {
    const src = "::: mermaid {#flow}\ngraph TD\n  A --> B\n:::\n";
    const doc = parseDoc(src);
    expect(doc.blocks[0]).toEqual({
      kind: "diagram",
      diagram: { id: "flow", text: "graph TD\n  A --> B" },
    });
    expect(serializeDoc(doc)).toBe(src);
  });

  it("throws on an unterminated diagram", () => {
    expect(() => parseDoc("::: mermaid {#flow}\ngraph TD")).toThrow(ParseError);
  });
});

describe("image blocks", () => {
  it("round-trips the image directive byte-identically", () => {
    const md =
      "::: image {#ops-photo}\n" +
      "src: data:image/png;base64,iVBORw0KGgo=\n" +
      'alt: "The ops team, Q3 all-hands"\n' +
      'caption: "Q3 all-hands"\n' +
      ":::\n";
    expect(serializeDoc(parseDoc(md))).toBe(md);
  });

  it("parses a standard Markdown image line and canonicalizes it", () => {
    const doc = parseDoc("![A cat](https://example.com/cat.png)");
    expect(doc.blocks[0]).toEqual({
      kind: "image",
      image: {
        id: "image-1",
        src: "https://example.com/cat.png",
        alt: "A cat",
      },
    });
    expect(serializeDoc(doc)).toBe(
      "::: image {#image-1}\n" +
        "src: https://example.com/cat.png\n" +
        'alt: "A cat"\n' +
        ":::\n",
    );
  });

  it("an image inside a prose line stays prose", () => {
    const doc = parseDoc("See ![a](b) for details.");
    expect(doc.blocks[0]?.kind).toBe("prose");
  });

  it("image ids count per document", () => {
    const doc = parseDoc("![a](b)\n\n![c](d)");
    const ids = doc.blocks
      .filter((b) => b.kind === "image")
      .map((b) => (b.kind === "image" ? b.image.id : ""));
    expect(ids).toEqual(["image-1", "image-2"]);
  });

  it("rejects an image directive without src", () => {
    expect(() => parseDoc('::: image {#x}\nalt: "nope"\n:::')).toThrow(/src/);
  });

  it("rejects unknown image directive keys", () => {
    expect(() =>
      parseDoc("::: image {#x}\nsrc: data:image/png;base64,A\nflip: yes\n:::"),
    ).toThrow(/Unknown image key/);
  });
});

describe("audio blocks", () => {
  const audioDoc =
    "::: audio {#clip}\n" +
    "src: data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA\n" +
    'alt: "wind chimes"\n' +
    'caption: "The porch, April"\n' +
    ":::\n";

  it("parses the audio directive with src, alt, and caption", () => {
    const doc = parseDoc(audioDoc);
    const b = doc.blocks[0];
    expect(b?.kind).toBe("audio");
    if (b?.kind === "audio") {
      expect(b.audio.id).toBe("clip");
      expect(b.audio.src).toBe(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
      );
      expect(b.audio.alt).toBe("wind chimes");
      expect(b.audio.caption).toBe("The porch, April");
    }
  });

  it("round-trips byte-identically", () => {
    expect(serializeDoc(parseDoc(audioDoc))).toBe(audioDoc);
  });

  it("requires src", () => {
    expect(() => parseDoc('::: audio {#x}\nalt: "nope"\n:::')).toThrow(
      /Audio directive missing src/,
    );
  });

  it("rejects unknown audio directive keys", () => {
    expect(() =>
      parseDoc("::: audio {#x}\nsrc: a.mp3\nloop: yes\n:::"),
    ).toThrow(/Unknown audio key/);
  });

  it("audio sits between other blocks without disturbing them", () => {
    const doc = parseDoc(`# T

${audioDoc}
After.`);
    expect(doc.blocks.map((b) => b.kind)).toEqual([
      "heading",
      "audio",
      "prose",
    ]);
    expect(serializeDoc(parseDoc(serializeDoc(doc)))).toBe(serializeDoc(doc));
  });
});
