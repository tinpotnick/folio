/**
 * Bundled grammar check (spec: docs/specs/spellcheck-grammar.md,
 * ADR-0033): Harper (harper.js, Apache-2.0) compiled to WASM, running
 * fully offline in the page. English-only today. The ~20 MB slim
 * binary is a lazy chunk (import("harper.js/slimBinary") - vite emits
 * the .wasm as a separate asset), fetched only when the user turns
 * grammar check on, so it never weighs the default load. Designed so
 * a future release could bundle it eagerly if it proves very usable.
 */

import type { Lint, Linter, Suggestion } from "harper.js";

let linter: Linter | null = null;
let loading: Promise<Linter | null> | null = null;

const KEY = "folio.grammar.v1";

/** Grammar check is opt-in (it downloads the WASM once, then runs
 * offline). Persisted per origin. */
export function grammarEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setGrammarEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // private mode - applies to this session only via the module state
  }
  enabled = on;
}

let enabled = grammarEnabled();

export async function getLinter(): Promise<Linter | null> {
  if (linter) return linter;
  if (!enabled) return null;
  if (!loading) {
    loading = (async () => {
      try {
        const [{ LocalLinter }, { slimBinary }] = await Promise.all([
          import("harper.js"),
          import("harper.js/slimBinary"),
        ]);
        const l = new LocalLinter({ binary: slimBinary });
        await l.setup();
        linter = l;
        return l;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

export interface GrammarHit {
  start: number;
  end: number;
  message: string;
  kind: string;
  suggestions: { text: string; suggestion: Suggestion }[];
  lint: Lint;
}

/** Lint one text (a prose block's markdown), markdown-aware. */
export async function lintText(text: string): Promise<GrammarHit[]> {
  const l = await getLinter();
  if (!l || text.trim() === "") return [];
  const lints = await l.lint(text, { language: "markdown" });
  return lints.map((lint) => {
    const span = lint.span();
    return {
      start: span.start,
      end: span.end,
      message: lint.message(),
      kind: lint.lint_kind(),
      suggestions: lint
        .suggestions()
        .map((s) => ({ text: s.get_replacement_text(), suggestion: s })),
      lint,
    };
  });
}

/** Apply one suggestion to the source text (returns the new text). */
export async function applyHit(
  text: string,
  hit: GrammarHit,
  suggestion: Suggestion,
): Promise<string> {
  const l = await getLinter();
  if (!l) return text;
  return l.applySuggestion(text, hit.lint, suggestion);
}
