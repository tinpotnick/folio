/**
 * Proofing marks for the Markdown SOURCE view (spec:
 * docs/specs/spellcheck-grammar.md). The host renders the source as a
 * transparent textarea over a highlight overlay (`.md-view` built from
 * highlightMarkdown's per-line tokens), so the bundled checkers can wrap
 * words in mark spans there exactly like in the document view - the
 * overlay is pure view; `editor.value` (the model) never contains marks.
 *
 * Only prose tokens are checked: code spans, fenced code, math, YAML
 * frontmatter, and ::: directive blocks/lists are markup, not prose.
 */

import type { MdLine, MdTokenKind } from "../render/highlight.js";
import {
  WORD_RE,
  isMisspelled,
  spellReady,
  type SpellChecker,
} from "./check.js";
import { grammarEnabled, lintText, type GrammarHit } from "./grammar.js";

/** Token kinds whose text is prose and gets checked. */
const PROSE_KINDS: ReadonlySet<MdTokenKind> = new Set([
  "text",
  "heading",
  "bold",
  "italic",
  "strike",
  "underline",
]);

/** Lines of the leading YAML frontmatter block (the highlighter emits
 * its values as plain "text" tokens, but frontmatter is metadata -
 * URLs and keys there are not prose). Empty when there is none. */
export function frontmatterLines(src: string): Set<number> {
  const out = new Set<number>();
  const lines = src.split("\n");
  if ((lines[0] ?? "").trim() !== "---") return out;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") return out;
    out.add(i);
  }
  return out;
}

export interface SourceMark {
  /** Line index in the source. */
  line: number;
  /** Token index within that line. */
  token: number;
  /** Char offset of the mark inside the token's text. */
  start: number;
  end: number;
  /** Absolute offset of `start` in the whole source (for hit-testing). */
  abs: number;
  kind: "spell" | "grammar";
  /** Index into the hits array (grammar marks only). */
  hit?: number;
}

/** Spell marks across all prose tokens of all lines. */
export function spellMarksInLines(
  lines: MdLine[],
  spell: SpellChecker,
  lineStarts: number[],
  skipLines?: ReadonlySet<number>,
): SourceMark[] {
  const out: SourceMark[] = [];
  lines.forEach((line, li) => {
    if (skipLines?.has(li)) return;
    let tokStart = 0;
    line.tokens.forEach((tok, ti) => {
      const tStart = tokStart;
      tokStart += tok.text.length;
      if (!PROSE_KINDS.has(tok.kind)) return;
      WORD_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WORD_RE.exec(tok.text)) !== null) {
        if (isMisspelled(spell, m[0])) {
          out.push({
            line: li,
            token: ti,
            start: m.index,
            end: m.index + m[0].length,
            abs: (lineStarts[li] ?? 0) + tStart + m.index,
            kind: "spell",
          });
        }
      }
    });
  });
  return out;
}

/** Grammar marks: map whole-source hit offsets to (line, token); a hit is
 * kept only when it lies inside a single prose token of one line. */
export function grammarMarksInLines(
  src: string,
  lines: MdLine[],
  lineStarts: number[],
  hits: GrammarHit[],
  skipLines?: ReadonlySet<number>,
): SourceMark[] {
  const out: SourceMark[] = [];
  hits.forEach((hit, hi) => {
    if (hit.end <= hit.start) return;
    // locate the line containing hit.start (lineStarts is sorted)
    let li = 0;
    for (let i = 0; i < lineStarts.length; i++) {
      if ((lineStarts[i] ?? 0) <= hit.start) li = i;
      else break;
    }
    const line = lines[li];
    if (!line || skipLines?.has(li)) return;
    const lineLen =
      (lineStarts[li + 1] ?? src.length + 1) - (lineStarts[li] ?? 0) - 1;
    if (hit.end > (lineStarts[li] ?? 0) + lineLen) return; // crosses lines
    const s = hit.start - (lineStarts[li] ?? 0);
    const e = hit.end - (lineStarts[li] ?? 0);
    let pos = 0;
    for (let ti = 0; ti < line.tokens.length; ti++) {
      const tok = line.tokens[ti];
      if (!tok) continue;
      const tEnd = pos + tok.text.length;
      if (s >= pos && e <= tEnd) {
        if (PROSE_KINDS.has(tok.kind)) {
          out.push({
            line: li,
            token: ti,
            start: s - pos,
            end: e - pos,
            abs: hit.start,
            kind: "grammar",
            hit: hi,
          });
        }
        return;
      }
      pos = tEnd;
    }
  });
  return out;
}

/** Offset of each line start in the source (lines are joined by "\n"). */
export function lineStartsOf(src: string): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const line of src.split("\n")) {
    starts.push(acc);
    acc += line.length + 1;
  }
  return starts;
}

export interface SourceMarksResult {
  marks: SourceMark[];
  hits: GrammarHit[];
}

/** All marks for the current source (spell when `spellOn`, grammar when
 * enabled). Async: awaits the dictionary / the grammar engine. */
export async function computeSourceMarks(
  src: string,
  lines: MdLine[],
  spellOn: boolean,
): Promise<SourceMarksResult> {
  const lineStarts = lineStartsOf(src);
  const skip = frontmatterLines(src);
  const marks: SourceMark[] = [];
  if (spellOn) {
    const s = await spellReady();
    if (s) marks.push(...spellMarksInLines(lines, s, lineStarts, skip));
  }
  let hits: GrammarHit[] = [];
  if (grammarEnabled()) {
    hits = await lintText(src);
    marks.push(...grammarMarksInLines(src, lines, lineStarts, hits, skip));
  }
  return { marks, hits };
}
