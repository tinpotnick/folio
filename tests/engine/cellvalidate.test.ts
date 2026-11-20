import { describe, expect, it } from "vitest";
import {
  expectedFor,
  isValidCellValue,
  type Column,
} from "../../src/engine/cellvalidate";

/**
 * Typed-column cell validation (spec: docs/specs/spellcheck-grammar.md
 * "Typed columns"): the editor underlines a typed cell whose text is
 * NOT a valid value of its column's type. Pure engine, no UI.
 */

const text: Column = { name: "note", type: "text" };
const num: Column = { name: "qty", type: "number" };
const date: Column = { name: "day", type: "date" };
const dt: Column = { name: "at", type: "datetime" };
const sel: Column = {
  name: "status",
  type: "select",
  options: ["open", "closed"],
};
const multi: Column = {
  name: "tags",
  type: "select",
  options: ["a", "b", "c"],
  multi: true,
};
const formula: Column = { name: "total", type: "formula", expr: "qty * 2" };
const rel: Column = { name: "link", type: "relation" };

const ALL: Column[] = [text, num, date, dt, sel, multi, formula, rel];

describe("isValidCellValue", () => {
  it("an empty cell is valid for every column type", () => {
    for (const col of ALL) {
      expect(isValidCellValue(col, "")).toBe(true);
      expect(isValidCellValue(col, "   ")).toBe(true);
    }
  });

  it("text accepts anything; formula/relation are computed and always valid", () => {
    expect(isValidCellValue(text, "anything at all, even 42x")).toBe(true);
    expect(isValidCellValue(formula, "not a formula")).toBe(true);
    expect(isValidCellValue(rel, "whatever")).toBe(true);
  });

  it("number accepts the same shape the engine's cell() coerces", () => {
    for (const v of ["42", "3.14", "-7", "0", " 12 "]) {
      expect(isValidCellValue(num, v)).toBe(true);
    }
    for (const v of ["abc", "1,000", "12px", "1.2.3", "--4", "3."]) {
      expect(isValidCellValue(num, v)).toBe(false);
    }
  });

  it("date accepts anything toIso() reads, including real calendar dates only", () => {
    for (const v of ["2026-11-17", "17 Nov 2026", "Nov 2026", "2026-11"]) {
      expect(isValidCellValue(date, v)).toBe(true);
    }
    for (const v of [
      "tomorrow",
      "2026-13-01",
      "2026-02-30",
      "32 Jan 2026",
      "11/17/2026",
    ]) {
      expect(isValidCellValue(date, v)).toBe(false);
    }
  });

  it("datetime accepts ISO date-times too", () => {
    expect(isValidCellValue(dt, "2026-11-17T09:30:00Z")).toBe(true);
    expect(isValidCellValue(dt, "2026-11-17 09:30")).toBe(true);
    expect(isValidCellValue(dt, "2026-11-17")).toBe(true);
    expect(isValidCellValue(dt, "tomorrow")).toBe(false);
  });

  it("select accepts only listed options (comma-split when multi)", () => {
    expect(isValidCellValue(sel, "open")).toBe(true);
    expect(isValidCellValue(sel, "nope")).toBe(false);
    expect(isValidCellValue(sel, "open, closed")).toBe(false);
    expect(isValidCellValue(multi, "a")).toBe(true);
    expect(isValidCellValue(multi, "a, b")).toBe(true);
    expect(isValidCellValue(multi, "a, x")).toBe(false);
  });
});

describe("expectedFor", () => {
  it("describes what each type expects for the invalid-value menu", () => {
    expect(expectedFor(num)).toContain("number");
    expect(expectedFor(date)).toContain("2026-11-17");
    expect(expectedFor(dt)).toContain("date and time");
    expect(expectedFor(sel)).toBe("one of: open, closed");
    expect(expectedFor(text)).toBe("a valid value");
    expect(expectedFor(formula)).toBe("a valid value");
  });
});
