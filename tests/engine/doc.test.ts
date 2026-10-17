import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc } from "@folio/engine/doc";
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
