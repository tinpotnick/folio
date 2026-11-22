import { describe, expect, it } from "vitest";
import { conflictsOf, merge3, mergeText } from "@folio/engine/merge";

/** Three-way merge (spec: docs/specs/save-conflicts.md). */

const clean = (chunks: ReturnType<typeof merge3>): string =>
  mergeText(chunks, () => "ours");

describe("merge3", () => {
  it("identical sides: all same, no conflicts", () => {
    const chunks = merge3("a\nb\nc\n", "a\nb\nc\n", "a\nb\nc\n");
    expect(conflictsOf(chunks)).toEqual([]);
    expect(clean(chunks)).toBe("a\nb\nc\n");
  });

  it("one-sided edits merge cleanly", () => {
    const base = "a\nb\nc\nd\n";
    const ours = "a\nB\nc\nd\n"; // line 2 changed
    const theirs = "a\nb\nc\nD\n"; // line 4 changed
    const chunks = merge3(base, ours, theirs);
    expect(conflictsOf(chunks)).toEqual([]);
    expect(clean(chunks)).toBe("a\nB\nc\nD\n");
  });

  it("both sides insert different text at different points", () => {
    const base = "a\nb\n";
    const chunks = merge3(base, "a\nX\nb\n", "X2\na\nb\n");
    expect(conflictsOf(chunks)).toEqual([]);
    expect(clean(chunks)).toBe("X2\na\nX\nb\n");
  });

  it("both sides edit the same line: a conflict hunk, no markers", () => {
    const base = "a\nb\nc\n";
    const chunks = merge3(base, "a\nOURS\nc\n", "a\nTHEIRS\nc\n");
    const cs = conflictsOf(chunks);
    expect(cs).toHaveLength(1);
    expect(cs[0]?.base).toEqual(["b"]);
    expect(cs[0]?.ours).toEqual(["OURS"]);
    expect(cs[0]?.theirs).toEqual(["THEIRS"]);
    expect(mergeText(chunks, () => "ours")).toBe("a\nOURS\nc\n");
    expect(mergeText(chunks, () => "theirs")).toBe("a\nTHEIRS\nc\n");
    // No conflict markers can leak into the text.
    expect(mergeText(chunks, () => "ours")).not.toContain("<<<<<<<");
  });

  it("adjacent edits (no unchanged line between) conflict, as git does", () => {
    const base = "a\nb\nc\n";
    const chunks = merge3(base, "a\nOURS\nc\n", "a\nb\nTHEIRS\n");
    expect(conflictsOf(chunks)).toHaveLength(1);
  });

  it("same edit on both sides is not a conflict", () => {
    const base = "a\nb\nc\n";
    const chunks = merge3(base, "a\nSAME\nc\n", "a\nSAME\nc\n");
    expect(conflictsOf(chunks)).toEqual([]);
    expect(clean(chunks)).toBe("a\nSAME\nc\n");
  });

  it("both insert different text at the same point: conflict", () => {
    const base = "a\nb\n";
    const chunks = merge3(base, "a\nX\nb\n", "a\nY\nb\n");
    const cs = conflictsOf(chunks);
    expect(cs).toHaveLength(1);
    expect(mergeText(chunks, () => "theirs")).toBe("a\nY\nb\n");
  });

  it("deletion on one side, edit on the other, apart: clean", () => {
    const base = "a\nb\nc\nd\n";
    const chunks = merge3(base, "a\nc\nd\n", "a\nb\nc\nD\n");
    expect(conflictsOf(chunks)).toEqual([]);
    expect(clean(chunks)).toBe("a\nc\nD\n");
  });

  it("a realistic document edit: prose line changed outside, table changed inside", () => {
    const base = "# T\n\nIntro.\n\n::: table {#t}\ndata:\n  - [1]\n:::\n";
    const ours =
      "# T\n\nIntro edited.\n\n::: table {#t}\ndata:\n  - [1]\n:::\n";
    const theirs = "# T\n\nIntro.\n\n::: table {#t}\ndata:\n  - [2]\n:::\n";
    const chunks = merge3(base, ours, theirs);
    expect(conflictsOf(chunks)).toEqual([]);
    expect(clean(chunks)).toBe(
      "# T\n\nIntro edited.\n\n::: table {#t}\ndata:\n  - [2]\n:::\n",
    );
  });

  it("empty base, both add content: conflict", () => {
    const chunks = merge3("", "hello\n", "world\n");
    expect(conflictsOf(chunks)).toHaveLength(1);
  });
});
