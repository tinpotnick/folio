// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { directiveBlockLines } from "../src/spell/source";
import {
  MAX_WORD_LEN,
  WORD_RE,
  addCustomWord,
  isMisspelled,
  suggestions,
  type SpellChecker,
} from "../src/spell/check";
import {
  MAX_LINT_RUN,
  grammarEnabled,
  lintText,
  maskForLint,
  setGrammarEnabled,
} from "../src/spell/grammar";

/**
 * Bundled proofing units (spec: docs/specs/spellcheck-grammar.md,
 * ADR-0033). The dictionary itself is exercised end-to-end in
 * tests/e2e/proofing.spec.ts - here we test the word logic against a
 * stub checker so no assets are fetched.
 */

const stub = (known: string[]): SpellChecker =>
  ({
    correct: (w: string) => known.includes(w),
    suggest: (w: string) => (w === "wordd" ? ["word", "words", "worded"] : []),
    add: () => {},
  }) as unknown as SpellChecker;

describe("WORD_RE", () => {
  it("extracts unicode words and keeps inner apostrophes", () => {
    const words = [..."don't stop, naïve café 123".matchAll(WORD_RE)].map(
      (m) => m[0],
    );
    expect(words).toEqual(["don't", "stop", "naïve", "café", "123"]);
  });
});

describe("isMisspelled / suggestions", () => {
  it("flags unknown words and offers suggestions, capped", () => {
    const s = stub(["word", "this", "is"]);
    expect(isMisspelled(s, "wordd")).toBe(true);
    expect(isMisspelled(s, "word")).toBe(false);
    expect(suggestions(s, "wordd")).toEqual(["word", "words", "worded"]);
    expect(suggestions(s, "nope")).toEqual([]);
  });

  it("oversized words never reach the dictionary (hunspell dies on them)", () => {
    // a pasted image's data: URL is one megabyte-scale "word" in the
    // source view; nspell.correct on it allocates until the tab OOMs
    const seen: string[] = [];
    const s = {
      correct: (w: string) => {
        seen.push(w);
        return false;
      },
      suggest: (w: string) => {
        seen.push(w);
        return [];
      },
      add: () => {},
    } as unknown as SpellChecker;
    expect(isMisspelled(s, "A".repeat(200_000))).toBe(false);
    expect(suggestions(s, "A".repeat(200_000))).toEqual([]);
    expect(seen).toEqual([]);
    // at the cap the checker is still consulted, past it never
    expect(isMisspelled(s, "x".repeat(MAX_WORD_LEN))).toBe(true);
    expect(seen).toEqual(["x".repeat(MAX_WORD_LEN)]);
    expect(isMisspelled(s, "x".repeat(MAX_WORD_LEN + 1))).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it("tokens containing any digit are never spell-checked (numbers, dates, versions, codes)", () => {
    // Regression (2026-11-18): every number in the document was
    // underlined red as a misspelling ("I have 3 dogs" squiggled the
    // 3; a date cell's digit runs were squiggled). The dictionary must
    // not even be consulted for them.
    const seen: string[] = [];
    const s = {
      correct: (w: string) => {
        seen.push(w);
        return false; // pretend everything is "unknown"
      },
      suggest: (w: string) => {
        seen.push(w);
        return ["x"];
      },
      add: () => {},
    } as unknown as SpellChecker;
    for (const tok of ["3", "2026", "17", "v0", "x1", "3a", "0.5"]) {
      expect(isMisspelled(s, tok)).toBe(false);
      expect(suggestions(s, tok)).toEqual([]);
    }
    expect(seen).toEqual([]);
    // a pure-letter token is still checked
    expect(isMisspelled(s, "wordd")).toBe(true);
    expect(seen).toEqual(["wordd"]);
  });

  it("custom words are never misspelled and persist to localStorage", () => {
    const s = stub(["word"]);
    addCustomWord("teh");
    expect(isMisspelled(s, "teh")).toBe(false);
    expect(isMisspelled(s, "TEH")).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("folio.spellcheck.custom.v1") ?? "[]"),
    ).toContain("teh");
  });
});

describe("grammar opt-in", () => {
  it("is off by default and persists when toggled", () => {
    expect(grammarEnabled()).toBe(false);
    setGrammarEnabled(true);
    expect(grammarEnabled()).toBe(true);
    expect(localStorage.getItem("folio.grammar.v1")).toBe("1");
    setGrammarEnabled(false);
    expect(grammarEnabled()).toBe(false);
    expect(localStorage.getItem("folio.grammar.v1")).toBeNull();
  });

  it("lintText returns nothing while disabled (never loads the wasm)", async () => {
    setGrammarEnabled(false);
    expect(await lintText("I saw the the dog.")).toEqual([]);
  });
});

describe("grammar lint input (maskForLint)", () => {
  it("blanks over-long runs and skipped lines, preserving every offset", () => {
    const blob = "A".repeat(MAX_LINT_RUN + 1);
    const src = `I saw the the dog.\nsrc: data:audio/ogg;base64,${blob}\nskip me\nkeep me`;
    const masked = maskForLint(src, new Set([2]));
    expect(masked.length).toBe(src.length);
    const lines = masked.split("\n");
    expect(lines[0]).toBe("I saw the the dog.");
    expect(lines[1]).toBe("src: " + " ".repeat((lines[1] ?? "").length - 5));
    expect(lines[2]).toBe("       ");
    expect(lines[3]).toBe("keep me");
  });

  it("leaves ordinary prose (and runs at the limit) untouched", () => {
    const src = `Plain prose with a URL https://example.com/a/b and ${"x".repeat(MAX_LINT_RUN)}.`;
    expect(maskForLint(src.slice(0, -1))).toBe(src.slice(0, -1));
  });

  it("the Levantine example reaches Harper with no data-URI payload", () => {
    // Regression: Harper took ~30 s on this file's base64 audio clips
    // and froze the app after switching to the source view.
    const src = readFileSync("demo/examples/levantine-arabic.md", "utf8");
    const masked = maskForLint(src, directiveBlockLines(src));
    expect(masked.length).toBe(src.length);
    expect(masked).not.toContain("base64,");
    expect(Math.max(...masked.split(/\s+/).map((w) => w.length))).toBeLessThan(
      MAX_LINT_RUN + 1,
    );
    expect(masked).toContain("Survival phrases");
  });
});
