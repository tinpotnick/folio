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

/** Prose tokens longer than this are not prose - they are data: URLs
 * (pasted images) or pasted blobs. Scanning them is pure cost (and
 * the base64 run inside is one giant "word"), so skip them whole. */
const MAX_PROSE_TOKEN = 4096;

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

/** Line indices inside any `::: name ...` ::: block (image, audio,
 * table, chart, mermaid, custom). Directive bodies are markup, not
 * prose: an image block's `src: data:...` line must never be
 * spell-checked (its base64 is not words). Empty when there are none. */
export function directiveBlockLines(src: string): Set<number> {
  const out = new Set<number>();
  const lines = src.split("\n");
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]?.trim() ?? "";
    if (depth === 0) {
      if (/^:::\s*\S/.test(t)) depth = 1;
    } else {
      out.add(i);
      if (t === ":::") depth = 0;
    }
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
      if (tok.text.length > MAX_PROSE_TOKEN) return;
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
        if (PROSE_KINDS.has(tok.kind) && tok.text.length <= MAX_PROSE_TOKEN) {
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
  for (const li of directiveBlockLines(src)) skip.add(li);
  // A line carrying a data: URI (rendered as a chip in the overlay) is
  // embed markup, not prose - never spell/grammar-marked (the base64
  // run used to peg the tab before the token cap).
  lines.forEach((line, li) => {
    if (line.tokens.some((t) => t.kind === "data")) skip.add(li);
  });
  const marks: SourceMark[] = [];
  if (spellOn) {
    const s = await spellReady();
    if (s) marks.push(...spellMarksInLines(lines, s, lineStarts, skip));
  }
  let hits: GrammarHit[] = [];
  if (grammarEnabled()) {
    // Directive bodies and frontmatter are masked out of the lint (their
    // hits are dropped below anyway): an audio/image block's data URI
    // costs Harper tens of seconds on the main thread.
    hits = await lintText(src, skip);
    marks.push(...grammarMarksInLines(src, lines, lineStarts, hits, skip));
  }
  return { marks, hits };
}
