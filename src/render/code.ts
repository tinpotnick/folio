/**
 * Code block languages and syntax highlighting (spec: docs/specs/
 * code-blocks.md, ADR-0015). highlight.js core and each grammar are
 * bundled and lazily imported on first use - never fetched, and a
 * document without code pays nothing (the Mermaid/KaTeX pattern).
 * Highlighting is presentation only: it paints spans over the code
 * text and never changes the text the model reads back.
 */
import type { HLJSApi, LanguageFn } from "highlight.js";

export interface CodeLanguage {
  /** The fence tag written to the Markdown source. */
  id: string;
  /** The name shown in the code header's language picker. */
  label: string;
}

/** The languages the code header offers, in picker order. */
export const CODE_LANGUAGES: CodeLanguage[] = [
  { id: "bash", label: "Shell" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "css", label: "CSS" },
  { id: "diff", label: "Diff" },
  { id: "go", label: "Go" },
  { id: "html", label: "HTML" },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript" },
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
  { id: "python", label: "Python" },
  { id: "rust", label: "Rust" },
  { id: "sql", label: "SQL" },
  { id: "strudel", label: "Strudel (music)" },
  { id: "jscad", label: "JSCAD (3D model)" },
  { id: "dot", label: "Graphviz (DOT diagram)" },
  { id: "vega-lite", label: "Vega-Lite (chart spec)" },
  { id: "svg", label: "SVG (drawing)" },
  { id: "abc", label: "ABC (sheet music)" },
  { id: "bibtex", label: "BibTeX (references)" },
  { id: "toml", label: "TOML" },
  { id: "typescript", label: "TypeScript" },
  { id: "xml", label: "XML" },
  { id: "yaml", label: "YAML" },
];

type Loader = () => Promise<{ default: LanguageFn }>;

/** highlight.js grammar loaders, keyed by grammar name. */
const GRAMMARS: Record<string, Loader> = {
  bash: () => import("highlight.js/lib/languages/bash"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  css: () => import("highlight.js/lib/languages/css"),
  diff: () => import("highlight.js/lib/languages/diff"),
  go: () => import("highlight.js/lib/languages/go"),
  ini: () => import("highlight.js/lib/languages/ini"),
  java: () => import("highlight.js/lib/languages/java"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  python: () => import("highlight.js/lib/languages/python"),
  rust: () => import("highlight.js/lib/languages/rust"),
  sql: () => import("highlight.js/lib/languages/sql"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  xml: () => import("highlight.js/lib/languages/xml"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
};

/** Fence tags (and common aliases) to the grammar that colors them. */
const GRAMMAR_FOR: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  c: "c",
  h: "c",
  cpp: "cpp",
  "c++": "cpp",
  cc: "cpp",
  csharp: "csharp",
  cs: "csharp",
  "c#": "csharp",
  css: "css",
  diff: "diff",
  patch: "diff",
  go: "go",
  golang: "go",
  html: "xml",
  xml: "xml",
  svg: "xml",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  // Strudel patterns are JavaScript with mini-notation strings.
  strudel: "javascript",
  // JSCAD models are JavaScript (spec: docs/specs/jscad-blocks.md).
  jscad: "javascript",
  "vega-lite": "json",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  python: "python",
  py: "python",
  rust: "rust",
  rs: "rust",
  sql: "sql",
  toml: "ini",
  ini: "ini",
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  yaml: "yaml",
  yml: "yaml",
};

/** The grammar for a fence tag, or null when it is not highlighted. */
export function grammarFor(lang: string | undefined): string | null {
  if (lang === undefined) return null;
  return GRAMMAR_FOR[lang.trim().toLowerCase()] ?? null;
}

let core: Promise<HLJSApi> | null = null;
const registered = new Map<string, Promise<boolean>>();

async function loadGrammar(name: string): Promise<HLJSApi | null> {
  const loader = GRAMMARS[name];
  if (!loader) return null;
  core ??= import("highlight.js/lib/core").then((m) => m.default);
  const hljs = await core;
  let done = registered.get(name);
  if (!done) {
    done = loader().then(
      (m) => {
        hljs.registerLanguage(name, m.default);
        return true;
      },
      () => false,
    );
    registered.set(name, done);
  }
  return (await done) ? hljs : null;
}

/** One colored run of code text: [start, end) with its token class. */
export interface CodeToken {
  start: number;
  end: number;
  cls: string;
}

/**
 * Tokenize code text for a fence tag. Resolves to null when the
 * language has no grammar (plain text, unknown tags) or loading
 * failed - the block then stays uncolored, never broken.
 */
export async function tokenizeCode(
  text: string,
  lang: string | undefined,
): Promise<CodeToken[] | null> {
  const name = grammarFor(lang);
  if (name === null) return null;
  const hljs = await loadGrammar(name);
  if (!hljs) return null;
  let html: string;
  try {
    html = hljs.highlight(text, { language: name, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
  // highlight.js returns escaped HTML; walk it back into offsets.
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const tokens: CodeToken[] = [];
  let pos = 0;
  const walk = (node: Node, cls: string): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const len = (child.textContent ?? "").length;
        if (cls !== "" && len > 0) {
          tokens.push({ start: pos, end: pos + len, cls });
        }
        pos += len;
      } else if (child instanceof HTMLElement) {
        // The innermost scope wins (a string inside a template
        // substitution colors as a string).
        walk(child, child.className || cls);
      }
    }
  };
  walk(tpl.content, "");
  return tokens;
}

/**
 * Paint code text into an element as colored spans. `marks` are
 * source ranges (strudel mini-notation atoms) wrapped in their own
 * span so playback can light them; overlapping marks after the
 * first are skipped. Returns the mark spans keyed "start:end".
 * The element's text content is exactly `text` afterwards.
 */
export function paintCode(
  el: HTMLElement,
  text: string,
  tokens: readonly CodeToken[],
  marks: ReadonlyArray<readonly [number, number]> = [],
): Map<string, HTMLElement> {
  const kept: Array<readonly [number, number]> = [];
  let edge = 0;
  for (const m of [...marks].sort((a, b) => a[0] - b[0])) {
    if (m[0] < edge || m[1] <= m[0] || m[1] > text.length) continue;
    kept.push(m);
    edge = m[1];
  }
  const cuts = new Set<number>([0, text.length]);
  for (const t of tokens) cuts.add(t.start).add(t.end);
  for (const m of kept) cuts.add(m[0]).add(m[1]);
  const points = [...cuts]
    .filter((c) => c >= 0 && c <= text.length)
    .sort((a, b) => a - b);
  const frag = document.createDocumentFragment();
  const byKey = new Map<string, HTMLElement>();
  let ti = 0;
  let mi = 0;
  let markEl: HTMLElement | null = null;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i] as number;
    const b = points[i + 1] as number;
    while (ti < tokens.length && (tokens[ti] as CodeToken).end <= a) ti++;
    while (mi < kept.length && (kept[mi] as readonly [number, number])[1] <= a)
      mi++;
    const tok = tokens[ti];
    const cls = tok && tok.start <= a && tok.end >= b ? tok.cls : "";
    const seg = text.slice(a, b);
    let node: Node;
    if (cls === "") {
      node = document.createTextNode(seg);
    } else {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = seg;
      node = span;
    }
    const mark = kept[mi];
    if (mark && mark[0] <= a && mark[1] >= b) {
      const key = `${mark[0]}:${mark[1]}`;
      if (!markEl || markEl.dataset.loc !== key) {
        markEl = document.createElement("span");
        markEl.className = "strudel-atom";
        markEl.dataset.loc = key;
        byKey.set(key, markEl);
        frag.appendChild(markEl);
      }
      markEl.appendChild(node);
    } else {
      markEl = null;
      frag.appendChild(node);
    }
  }
  el.replaceChildren(frag);
  return byKey;
}
