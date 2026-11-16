// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { highlightMarkdown } from "../src/render/highlight";
import type { SpellChecker } from "../src/spell/check";
import {
  frontmatterLines,
  grammarMarksInLines,
  lineStartsOf,
  spellMarksInLines,
  type SourceMark,
} from "../src/spell/source";
import type { GrammarHit } from "../src/spell/grammar";

/**
 * Source-view proofing marks (spec: docs/specs/spellcheck-grammar.md):
 * marks are computed over the highlight overlay's tokens, prose only -
 * never code spans, fenced code, math, frontmatter or ::: directives.
 */

const MISSPELLED = /wordd|boold|codee|fencedd|celll|headding|teh|docc/i;
const stub = {
  correct: (w: string) => !MISSPELLED.test(w),
  suggest: () => [],
  add: () => {},
} as unknown as SpellChecker;

const DOC = [
  "---",
  "title: My Docc",
  "url: https://example.com/wordd",
  "---",
  "",
  "# Headding wordd",
  "",
  "This wordd is **boold** and `codee` plus teh end.",
  "",
  "```js",
  "fencedd codee",
  "```",
  "",
  "::: table {#t}",
  'caption: "T"',
  "data:",
  "  - [celll wordd]",
  ":::",
].join("\n");

const hit = (start: number, end: number): GrammarHit =>
  ({ start, end }) as unknown as GrammarHit;

describe("frontmatterLines", () => {
  it("returns the leading YAML block's line indices, none otherwise", () => {
    expect([...frontmatterLines(DOC)].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(frontmatterLines("# No frontmatter\n\ntext")).toEqual(new Set());
  });
});

describe("lineStartsOf", () => {
  it("maps each line to its absolute offset", () => {
    expect(lineStartsOf("ab\ncde\nf")).toEqual([0, 3, 7]);
  });
});

describe("spellMarksInLines", () => {
  const lines = highlightMarkdown(DOC);
  const starts = lineStartsOf(DOC);
  const marks = spellMarksInLines(lines, stub, starts, frontmatterLines(DOC));
  const words = marks.map((m) => {
    const tok = lines[m.line]?.tokens[m.token];
    return (tok?.text ?? "").slice(m.start, m.end);
  });

  it("marks misspellings in prose tokens (text, heading, bold)", () => {
    expect(words).toEqual(["Headding", "wordd", "wordd", "boold", "teh"]);
  });

  it("never marks code spans, fenced code, directives or frontmatter", () => {
    for (const m of marks) {
      const kind = lines[m.line]?.tokens[m.token]?.kind;
      expect([
        "text",
        "heading",
        "bold",
        "italic",
        "strike",
        "underline",
      ]).toContain(kind);
      expect(frontmatterLines(DOC).has(m.line)).toBe(false);
    }
    // absolute offsets point at the word in the raw source
    for (const m of marks) {
      expect(DOC.slice(m.abs, m.abs + (m.end - m.start))).toBe(
        (lines[m.line]?.tokens[m.token]?.text ?? "").slice(m.start, m.end),
      );
    }
  });

  it("skips giant tokens whole - a pasted image's data: URL line", () => {
    const big = "data:image/png;base64," + "A".repeat(200_000);
    const doc = `# T\n\n::: image {#image-1}\nsrc: ${big}\nalt: "wordd photo"\n:::\n`;
    const seen: string[] = [];
    const recording = {
      correct: (w: string) => {
        seen.push(w);
        return !MISSPELLED.test(w);
      },
      suggest: () => [],
      add: () => {},
    } as unknown as SpellChecker;
    const lines = highlightMarkdown(doc);
    const marks = spellMarksInLines(
      lines,
      recording,
      lineStartsOf(doc),
      frontmatterLines(doc),
    );
    // only the real prose word is marked; the base64 run is never
    // even offered to the checker
    expect(
      marks.map((m) => doc.slice(m.abs, m.abs + (m.end - m.start))),
    ).toEqual(["wordd"]);
    expect(seen.some((w) => w.length > 4096)).toBe(false);
  });

  it("carries line/token/start/end plus absolute offset", () => {
    const m = marks.find((x) => x.line === 7 && x.kind === "spell");
    expect(m).toBeDefined();
    const tok = lines[7]?.tokens[m?.token ?? 0];
    expect(tok?.kind).toBe("text");
    expect(
      DOC.slice(m?.abs ?? 0, (m?.abs ?? 0) + (m?.end ?? 0) - (m?.start ?? 0)),
    ).toMatch(/^wordd$/);
  });
});

describe("grammarMarksInLines", () => {
  it("maps whole-source hits onto the line/token, prose only", () => {
    const src = "I saw the the dog.\n\nnext line";
    const lines = highlightMarkdown(src);
    const starts = lineStartsOf(src);
    const marks = grammarMarksInLines(
      src,
      lines,
      starts,
      [hit(6, 13)],
      frontmatterLines(src),
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.kind).toBe("grammar");
    expect(marks[0]?.hit).toBe(0);
    expect(src.slice(marks[0]?.abs ?? 0, (marks[0]?.abs ?? 0) + 7)).toBe(
      "the the",
    );
  });

  it("skips hits that cross line boundaries or land in non-prose tokens", () => {
    const src = "abc def\n`codee` tail";
    const lines = highlightMarkdown(src);
    const starts = lineStartsOf(src);
    const marks = grammarMarksInLines(
      src,
      lines,
      starts,
      [hit(1, 8), hit(11, 16)], // crosses lines; inside the code span
      frontmatterLines(src),
    );
    expect(marks).toHaveLength(0);
  });
});

describe("SourceMark shape", () => {
  it("spell marks carry kind spell and no hit index", () => {
    const lines = highlightMarkdown("a wordd b");
    const marks: SourceMark[] = spellMarksInLines(
      lines,
      stub,
      lineStartsOf("a wordd b"),
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.kind).toBe("spell");
    expect(marks[0]?.hit).toBeUndefined();
  });
});
