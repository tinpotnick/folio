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

describe("lists", () => {
  const rt = (text: string): string => serializeDoc(parseDoc(text));
  const t = (text: string) => ({ text });

  it("parses a bulleted list into one list block of inline items", () => {
    const doc = parseDoc("Intro:\n\n- One **bold**\n- Two [link](x.md)\n");
    expect(doc.blocks[1]).toEqual({
      kind: "list",
      ordered: false,
      items: [t("One **bold**"), t("Two [link](x.md)")],
    });
  });

  it("parses a numbered list, keeping a non-1 start", () => {
    expect(parseDoc("1. a\n2. b\n").blocks[0]).toEqual({
      kind: "list",
      ordered: true,
      items: [t("a"), t("b")],
    });
    expect(parseDoc("3. c\n4. d\n").blocks[0]).toMatchObject({ start: 3 });
  });

  it("indented continuation lines belong to their item", () => {
    const doc = parseDoc("- A long item\n  that wraps\n- Next\n");
    expect(doc.blocks[0]).toMatchObject({
      items: [t("A long item\nthat wraps"), t("Next")],
    });
  });

  it("canonical lists round-trip byte-identically", () => {
    for (const text of [
      "- one\n- two\n",
      "Intro\n\n- a\n  wrapped\n- b\n\nAfter\n",
      "1. a\n2. b\n   wrapped\n",
      "7. seven\n8. eight\n",
      "- a\n\n- b\n",
      "- a\n-\n- c\n",
      "- top\n  - nested\n",
      "1. Prepare\n   - fonts\n   - colours\n2. Ship\n",
      "- a\n  - b\n    1. c\n       wrapped\n    2. d\n  - e\n- f\n",
    ]) {
      expect(rt(text), JSON.stringify(text)).toBe(text);
    }
  });

  it("non-canonical markers canonicalize", () => {
    expect(rt("* a\n+ b\n")).toBe("- a\n- b\n");
    expect(rt("1) a\n1) b\n")).toBe("1. a\n2. b\n");
  });

  it("a dash line inside a paragraph stays paragraph text", () => {
    const doc = parseDoc("Some prose\n- not a list\n");
    expect(doc.blocks).toEqual([
      { kind: "prose", text: "Some prose\n- not a list" },
    ]);
  });

  it("emphasis and rules are not bullets", () => {
    expect(parseDoc("*emphasis* first\n").blocks[0]?.kind).toBe("prose");
    expect(parseDoc("2024 was a year\n").blocks[0]?.kind).toBe("prose");
  });
});

describe("nested lists", () => {
  const rt = (text: string): string => serializeDoc(parseDoc(text));

  it("an indented item starts its parent's sub-list, of its own kind", () => {
    expect(
      parseDoc("1. Prepare\n   - fonts\n   - colours\n2. Ship\n").blocks[0],
    ).toEqual({
      kind: "list",
      ordered: true,
      items: [
        {
          text: "Prepare",
          children: {
            ordered: false,
            items: [{ text: "fonts" }, { text: "colours" }],
          },
        },
        { text: "Ship" },
      ],
    });
  });

  it("three levels deep, with a continuation line at depth", () => {
    const doc = parseDoc("- a\n  - b\n    - c\n      more c\n  - d\n");
    expect(doc.blocks[0]).toEqual({
      kind: "list",
      ordered: false,
      items: [
        {
          text: "a",
          children: {
            ordered: false,
            items: [
              {
                text: "b",
                children: {
                  ordered: false,
                  items: [{ text: "c\nmore c" }],
                },
              },
              { text: "d" },
            ],
          },
        },
      ],
    });
  });

  it("deeper or shallower indents canonicalize to the content column", () => {
    expect(rt("- a\n    - b\n")).toBe("- a\n  - b\n");
    expect(rt("1. a\n  - b\n")).toBe("1. a\n   - b\n");
  });

  it("a nested numbered list keeps its own start", () => {
    expect(rt("- a\n  3. x\n  4. y\n")).toBe("- a\n  3. x\n  4. y\n");
  });
});

describe("simple (GFM pipe) tables", () => {
  const rt = (text: string): string => serializeDoc(parseDoc(text));
  const gfm =
    "| Name  | Qty |  Note  |\n" +
    "| ----- | --: | :----: |\n" +
    "| Apple |  12 | crisp  |\n" +
    "| Pear  |   3 | a \\| b |\n";

  it("a pipe table parses as a SIMPLE table: text cells, alignments kept", () => {
    const block = parseDoc(`# T\n\n${gfm}`).blocks[1];
    expect(block?.kind).toBe("table");
    if (block?.kind !== "table") return;
    expect(block.table.simple?.align).toEqual(["none", "right", "center"]);
    expect(block.table.columns.map((c) => [c.name, c.type])).toEqual([
      ["Name", "text"],
      ["Qty", "text"],
      ["Note", "text"],
    ]);
    // Cells stay text, exactly as written (no "3.50" -> 3.5 drift);
    // an escaped pipe is a literal pipe in the cell.
    expect(block.table.rows).toEqual([
      ["Apple", "12", "crisp"],
      ["Pear", "3", "a | b"],
    ]);
  });

  it("Prettier-formatted pipe tables round-trip byte-identically", () => {
    for (const text of [
      `# T\n\n${gfm}`,
      "| a   | b   |\n| --- | --- |\n| 1   | 2   |\n",
      "Intro\n\n| x   |\n| --- |\n\nAfter\n",
      "| Item | Cost |\n| :--- | ---: |\n| Tea  | 3.50 |\n",
    ]) {
      expect(rt(text), JSON.stringify(text)).toBe(text);
    }
  });

  it("unpadded pipe tables keep their layout until edited", () => {
    // Canonical (Prettier) layout applies only once the content
    // changes - see "simple tables keep their author's formatting".
    expect(rt("|a|bb|\n|-|-:|\n|1|2|\n")).toBe("|a|bb|\n|-|-:|\n|1|2|\n");
  });

  it("short rows pad with empty cells", () => {
    const block = parseDoc("| a | b |\n| - | - |\n| 1 |\n").blocks[0];
    expect(block?.kind === "table" && block.table.rows).toEqual([["1", ""]]);
  });

  it("a pipe line inside a paragraph stays paragraph text", () => {
    expect(parseDoc("Some prose\n| not | a table |\n").blocks[0]?.kind).toBe(
      "prose",
    );
  });

  it("a pipe line without a delimiter row is not a table", () => {
    expect(parseDoc("| just | pipes |\n").blocks[0]?.kind).toBe("prose");
  });

  it("datasets still serialize as ::: table", () => {
    const text = loadGolden("sample-document.md");
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });
});

describe("simple tables keep their author's formatting", () => {
  // Regression (first-contact eval): an untouched hand-formatted
  // pipe table was re-padded on every save - churn in a GitHub diff.
  it("an unedited table re-serializes exactly as written", () => {
    const text =
      "| Fruit   | Qty | Price |\n|:--------|----:|------:|\n| Apple   |   3 |  1.20 |\n";
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it("an EDITED table takes the canonical layout", () => {
    const doc = parseDoc("|a|b|\n|-|-|\n|1|2|\n");
    const t = doc.blocks[0];
    if (t?.kind !== "table") throw new Error("not a table");
    t.table.rows[0] = ["10", "2"];
    expect(serializeDoc(doc)).toBe(
      "| a   | b   |\n| --- | --- |\n| 10  | 2   |\n",
    );
  });
});
