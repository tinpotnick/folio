/**
 * Markdown syntax highlighter for the source editor (ADR-0001:
 * pure computation, zero UI deps, no new dependencies per
 * ADR-0007). Emits typed tokens per line; the host editor maps
 * token kinds to CSS classes (VS Code-style coloring) and the
 * transparent-textarea overlay keeps editing native.
 */
export type MdTokenKind =
  | "fence"
  | "frontmatter-delim"
  | "frontmatter-key"
  | "heading"
  | "bullet"
  | "bold"
  | "italic"
  | "strike"
  | "underline"
  | "sub"
  | "sup"
  | "code"
  | "math"
  | "directive"
  | "directive-key"
  | "directive-list"
  | "data"
  | "text";

export interface MdToken {
  kind: MdTokenKind;
  text: string;
}

export interface MdLine {
  tokens: MdToken[];
}

export function highlightMarkdown(src: string): MdLine[] {
  const lines = src.split("\n");
  let inFrontmatter = false;
  let frontmatterSeen = false;
  let directiveDepth = 0;
  let inMermaid = false;
  let inFence = false;
  let inMath = false;
  return lines.map((line) => {
    let tokens: MdToken[];
    if (inMermaid) {
      if (line.trim() === ":::") {
        inMermaid = false;
        tokens = [{ kind: "directive", text: line }];
      } else {
        tokens = [{ kind: "code", text: line }];
      }
    } else if (inFence) {
      if (/^`{3,}$/.test(line.trim())) {
        inFence = false;
        tokens = [{ kind: "fence", text: line }];
      } else {
        tokens = [{ kind: "code", text: line }];
      }
    } else if (inMath) {
      if (line.trim() === "$$") {
        inMath = false;
        tokens = [{ kind: "math", text: line }];
      } else {
        tokens = [{ kind: "math", text: line }];
      }
    } else if (line.trim() === "$$") {
      inMath = true;
      tokens = [{ kind: "math", text: line }];
    } else if (/^`{3,}\S*$/.test(line.trim())) {
      inFence = true;
      tokens = [{ kind: "fence", text: line }];
    } else if (inFrontmatter) {
      if (line.trim() === "---") {
        inFrontmatter = false;
        frontmatterSeen = true;
        tokens = [{ kind: "frontmatter-delim", text: line }];
      } else {
        tokens = frontmatterLine(line);
      }
    } else if (!frontmatterSeen && line.trim() === "---") {
      inFrontmatter = true;
      tokens = [{ kind: "frontmatter-delim", text: line }];
    } else if (directiveDepth > 0) {
      if (line.trim() === ":::") {
        directiveDepth = 0;
        tokens = [{ kind: "directive", text: line }];
      } else {
        tokens = directiveLine(line);
      }
    } else if (/^::: mermaid \{#[^}]+\}$/.test(line.trim())) {
      inMermaid = true;
      tokens = [{ kind: "directive", text: line }];
    } else if (
      /^::: (table|chart|image|audio|flashcards|value|motion|comment|page) \{#[^}]+\}$/.test(
        line.trim(),
      )
    ) {
      // Every standard directive opens a directive body - including
      // audio/image, whose `src:` line can be a multi-KB data URI that
      // must take the cheap directive path, never inline scanning.
      directiveDepth = 1;
      tokens = [{ kind: "directive", text: line }];
    } else if (/^#{1,6} /.test(line)) {
      tokens = [{ kind: "heading", text: line }];
    } else if (/^\s*[-*] /.test(line)) {
      tokens = bulletLine(line);
    } else {
      tokens = inlineTokens(line);
    }
    return { tokens: splitDataTokens(tokens) };
  });
}

/** A `data:` URI with a base64 payload longer than this becomes its own
 * `data` token, so the host can render it as a compact chip instead of a
 * multi-KB text run (spec: docs/specs/section-browser-and-highlighting.md
 * - in a plain text editor the URI is all there; in folio it is a chip).
 * The token's text is the FULL URI: the round-trip property (concatenated
 * token text equals the source) still holds, and the textarea/file keep
 * the real bytes. */
const MIN_DATA_PAYLOAD = 128;
const DATA_URI_RE = new RegExp(
  `data:([^\\s;,]{1,120});base64,([A-Za-z0-9+/=]{${String(MIN_DATA_PAYLOAD)},})`,
  "g",
);

function splitDataTokens(tokens: MdToken[]): MdToken[] {
  const out: MdToken[] = [];
  for (const tok of tokens) {
    DATA_URI_RE.lastIndex = 0;
    let last = 0;
    let found = false;
    let m: RegExpExecArray | null;
    while ((m = DATA_URI_RE.exec(tok.text)) !== null) {
      found = true;
      if (m.index > last)
        out.push({ kind: tok.kind, text: tok.text.slice(last, m.index) });
      out.push({ kind: "data", text: m[0] });
      last = m.index + m[0].length;
    }
    if (!found) out.push(tok);
    else if (last < tok.text.length)
      out.push({ kind: tok.kind, text: tok.text.slice(last) });
  }
  return out;
}

function frontmatterLine(line: string): MdToken[] {
  const m =
    /^ {2}([\w.]+): (.*)$/.exec(line) ?? /^(\w[\w-]*): (.*)$/.exec(line);
  if (m) {
    const key = m[1] ?? "";
    return [
      { kind: "frontmatter-key", text: line.slice(0, key.length) },
      { kind: "text", text: line.slice(key.length) },
    ];
  }
  return [{ kind: "text", text: line }];
}

function directiveLine(line: string): MdToken[] {
  const m = /^(\s*)([\w]+):(.*)$/.exec(line);
  if (m) {
    return [
      { kind: "text", text: m[1] ?? "" },
      { kind: "directive-key", text: `${m[2] ?? ""}:` },
      { kind: "text", text: m[3] ?? "" },
    ];
  }
  if (/^\s*-\s/.test(line)) {
    return [{ kind: "directive-list", text: line }];
  }
  return [{ kind: "text", text: line }];
}

function bulletLine(line: string): MdToken[] {
  const m = /^(\s*[-*] )(.*)$/.exec(line);
  if (!m) return [{ kind: "text", text: line }];
  return [{ kind: "bullet", text: m[1] ?? "" }, ...inlineTokens(m[2] ?? "")];
}

/** Lines longer than this are one plain token, no inline scanning:
 * the per-character regexes below cost seconds on a multi-MB line (a
 * data: URL), and that cost is paid on EVERY keystroke in the source
 * view. No real prose line is anywhere near this long. */
const MAX_INLINE_LINE = 8192;

function inlineTokens(text: string): MdToken[] {
  if (text.length > MAX_INLINE_LINE) return [{ kind: "text", text }];
  const out: MdToken[] = [];
  let cur = "";
  let i = 0;
  const push = (kind: MdTokenKind, s: string): void => {
    if (cur) {
      out.push({ kind: "text", text: cur });
      cur = "";
    }
    out.push({ kind, text: s });
  };
  while (i < text.length) {
    const rest = text.slice(i);
    let m = /^\*\*([^*]+)\*\*/.exec(rest);
    if (m) {
      push("bold", m[0]);
      i += m[0].length;
      continue;
    }
    m = /^\*([^*\n]+)\*/.exec(rest);
    if (m) {
      push("italic", m[0]);
      i += m[0].length;
      continue;
    }
    m = /^~~([^~\n]+)~~/.exec(rest);
    if (m) {
      push("strike", m[0]);
      i += m[0].length;
      continue;
    }
    m = /^\+\+([^+\n]+)\+\+/.exec(rest);
    if (m) {
      push("underline", m[0]);
      i += m[0].length;
      continue;
    }
    // After ~~ so a double tilde never reads as a subscript opener.
    m = /^\^(\S(?:[^^\n]*\S)?)\^/.exec(rest);
    if (m) {
      push("sup", m[0]);
      i += m[0].length;
      continue;
    }
    m = /^~(\S(?:[^~\n]*\S)?)~/.exec(rest);
    if (m) {
      push("sub", m[0]);
      i += m[0].length;
      continue;
    }
    m = /^`([^`\n]+)`/.exec(rest);
    if (m) {
      push("code", m[0]);
      i += m[0].length;
      continue;
    }
    cur += text[i] ?? "";
    i++;
  }
  if (cur) out.push({ kind: "text", text: cur });
  return out;
}
