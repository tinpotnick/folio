/**
 * BibTeX, read (spec: docs/specs/citations.md, ADR-0028). A document's
 * bibliography is a ```bibtex block - what Google Scholar, Zotero,
 * Mendeley and every journal's "Cite" button export - so a reference
 * is pasted, never retyped. Read-only: the block's text is the source
 * of truth and is never rewritten.
 */

export interface Name {
  family: string;
  given: string;
}

export interface BibEntry {
  key: string;
  /** Lower case: article, book, inproceedings, ... */
  type: string;
  /** Lower-case field names; values with LaTeX turned into text. */
  fields: Record<string, string>;
  authors: Name[];
  editors: Name[];
}

export interface Bibliography {
  entries: BibEntry[];
  /** What could not be read, in words, with the entry it was in. */
  errors: string[];
}

const MONTHS: Record<string, string> = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};

/** Accent commands -> the combining mark they put on a letter. */
const ACCENTS: Record<string, string> = {
  '"': "̈",
  "'": "́",
  "`": "̀",
  "^": "̂",
  "~": "̃",
  "=": "̄",
  ".": "̇",
  c: "̧",
  v: "̌",
  u: "̆",
  H: "̋",
  k: "̨",
  r: "̊",
};

/** Letter commands (\ss, \o, ...) -> their character. */
const LETTERS: Record<string, string> = {
  ss: "ß",
  o: "ø",
  O: "Ø",
  aa: "å",
  AA: "Å",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  l: "ł",
  L: "Ł",
  i: "ı",
  j: "ȷ",
};

/**
 * LaTeX markup in a field -> plain text: accents become Unicode,
 * dashes and quotes become typography, formatting commands keep their
 * words, and protective braces go.
 */
export function latexToText(s: string): string {
  return (
    s
      // \"{o}, {\"o}, \"o, \c{c}, \v s
      .replace(
        /\\(["'`^~=.]|[cvuHkr](?![a-zA-Z]))\s*(?:\{\s*(\\?[a-zA-Z])\s*\}|(\\?[a-zA-Z]))/g,
        (_m, acc: string, a?: string, b?: string) => {
          const letter = (a ?? b ?? "").replace(/^\\([ij])$/, "$1");
          return (letter + (ACCENTS[acc] ?? "")).normalize("NFC");
        },
      )
      .replace(
        /\\(ss|aa|AA|ae|AE|oe|OE|o|O|l|L|i|j)(?![a-zA-Z])\s?/g,
        (_m, c: string) => LETTERS[c] ?? c,
      )
      .replace(/\\([&%$#_{}])/g, "$1")
      .replace(/\\(La)?TeX\b\s?/g, (_m, la?: string) => `${la ?? ""}TeX`)
      // \textit{x}, \emph{x}, \url{x}: the words stay
      .replace(/\\[a-zA-Z]+\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\[a-zA-Z]+\s*/g, "")
      .replace(/---/g, "—")
      .replace(/--/g, "–")
      .replace(/``/g, "“")
      .replace(/''/g, "”")
      .replace(/~/g, " ")
      .replace(/[{}]/g, "")
      .replace(/[ \t\r\n]+/g, " ")
      .replace(/^ | $/g, "")
  );
}

/** Split at top-level (brace depth 0) occurrences of a separator. */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0) {
      sep.lastIndex = i;
      const m = sep.exec(s);
      if (m && m.index === i) {
        out.push(s.slice(start, i));
        start = i + m[0].length;
        i = start - 1;
      }
    }
  }
  out.push(s.slice(start));
  return out;
}

/** "Family, Given", "Given Family", "von Family, Jr, Given". */
function parseName(raw: string): Name {
  const parts = splitTop(raw.trim(), /,/y).map((p) => p.trim());
  if (parts.length >= 2) {
    return {
      family: latexToText(parts[0] ?? ""),
      given: latexToText(parts[parts.length - 1] ?? ""),
    };
  }
  // A braced name is one corporate name: {World Health Organization}.
  if (/^\{.*\}$/.test(raw.trim())) {
    return { family: latexToText(raw), given: "" };
  }
  const words = splitTop(raw.trim(), /\s+/y).filter(Boolean);
  // "Ludwig van Beethoven": lower-case words start the family name.
  let f = words.length - 1;
  while (f > 0 && /^[a-z]/.test(words[f - 1] ?? "")) f--;
  return {
    family: latexToText(words.slice(f).join(" ")),
    given: latexToText(words.slice(0, f).join(" ")),
  };
}

export function parseNames(raw: string | undefined): Name[] {
  if (!raw) return [];
  return splitTop(raw, /\s+and\s+/iy)
    .map((n) => n.trim())
    .filter((n) => n && n !== "others")
    .map(parseName)
    .concat(
      /\s+and\s+others\s*$/i.test(raw) ? [{ family: "others", given: "" }] : [],
    );
}

/** Read one field value at `i`: {...}, "...", a number or a macro, joined by #. */
function readValue(
  src: string,
  i: number,
  strings: Record<string, string>,
): { value: string; end: number } {
  let value = "";
  for (;;) {
    while (/\s/.test(src[i] ?? "")) i++;
    const c = src[i];
    if (c === "{") {
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      value += src.slice(i + 1, j - 1);
      i = j;
    } else if (c === '"') {
      let depth = 0;
      let j = i + 1;
      while (j < src.length && !(src[j] === '"' && depth === 0)) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      value += src.slice(i + 1, j);
      i = j + 1;
    } else {
      const m = /^[^\s,#}]+/.exec(src.slice(i));
      const word = m?.[0] ?? "";
      value +=
        strings[word.toLowerCase()] ?? MONTHS[word.toLowerCase()] ?? word;
      i += word.length;
    }
    while (/\s/.test(src[i] ?? "")) i++;
    if (src[i] !== "#") return { value, end: i };
    i++;
  }
}

export function parseBibtex(src: string): Bibliography {
  const entries: BibEntry[] = [];
  const errors: string[] = [];
  const strings: Record<string, string> = {};
  const seen = new Set<string>();
  const at = /@\s*([a-zA-Z]+)\s*([{(])/g;
  let m: RegExpExecArray | null;
  while ((m = at.exec(src))) {
    const type = (m[1] ?? "").toLowerCase();
    const close = m[2] === "(" ? ")" : "}";
    let i = at.lastIndex;
    if (type === "comment" || type === "preamble") {
      // Skip to the matching close.
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === "{" || src[i] === "(") depth++;
        else if (src[i] === "}" || src[i] === ")") depth--;
        i++;
      }
      at.lastIndex = i;
      continue;
    }
    if (type === "string") {
      const name = /^\s*([^\s=]+)\s*=/.exec(src.slice(i));
      if (name) {
        const v = readValue(src, i + name[0].length, strings);
        strings[(name[1] ?? "").toLowerCase()] = v.value;
        i = v.end;
      }
      while (i < src.length && src[i] !== close) i++;
      at.lastIndex = i + 1;
      continue;
    }
    const keyM = /^\s*([^\s,]+)\s*,/.exec(src.slice(i));
    if (!keyM) {
      errors.push(`An @${type} entry has no key`);
      continue;
    }
    const key = keyM[1] ?? "";
    i += keyM[0].length;
    const raw: Record<string, string> = {};
    for (;;) {
      while (/[\s,]/.test(src[i] ?? "")) i++;
      if (i >= src.length) {
        errors.push(`"${key}" is not closed - a } is missing`);
        break;
      }
      if (src[i] === close) {
        i++;
        break;
      }
      const f = /^([^\s=,{}]+)\s*=/.exec(src.slice(i));
      if (!f) {
        errors.push(
          `"${key}" has something that is not a field near "${src.slice(i, i + 20).trim()}"`,
        );
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      i += f[0].length;
      const v = readValue(src, i, strings);
      raw[(f[1] ?? "").toLowerCase()] = v.value;
      i = v.end;
    }
    at.lastIndex = i;
    if (seen.has(key)) {
      errors.push(`"${key}" appears twice - the first is used`);
      continue;
    }
    seen.add(key);
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === "author" || k === "editor") continue;
      // Links and DOIs are addresses, not prose: only braces go.
      fields[k] = /^(url|doi)$/.test(k)
        ? v.replace(/[{}]/g, "").trim()
        : latexToText(v);
    }
    // BibLaTeX's date = {2020-05-01} gives the year.
    if (!fields.year && fields.date) {
      fields.year = /^\d{4}/.exec(fields.date)?.[0] ?? fields.date;
    }
    if (!fields.journal && fields.journaltitle)
      fields.journal = fields.journaltitle;
    if (!fields.school && fields.institution && /thesis/.test(type)) {
      fields.school = fields.institution;
    }
    entries.push({
      key,
      type,
      fields,
      authors: parseNames(raw.author),
      editors: parseNames(raw.editor),
    });
  }
  return { entries, errors };
}
