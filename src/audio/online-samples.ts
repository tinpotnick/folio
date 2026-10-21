/**
 * Online sample banks (ADR-0019, spec: docs/specs/strudel-blocks.md
 * "Online samples"): a strudel pattern may load its OWN sample bank
 * from the internet - `samples('github:tidalcycles/dirt-samples')`,
 * as many strudel.cc examples do. folio plays offline by default, so
 * such a download needs the user's consent first. This finds what a
 * pattern would download.
 */

/** Sources strudel fetches over the network. */
const ONLINE_RE = /^(?:github:|https?:\/\/|shabda:)/;

/** Drop `//` line comments and block comments, keeping strings. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/**
 * The internet sources a pattern's `samples(...)` calls would load,
 * each once, in order of appearance.
 */
export function onlineSampleSources(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  const call = /\bsamples\s*\(/g;
  for (let m = call.exec(code); m !== null; m = call.exec(code)) {
    // The call's argument text: up to its matching close paren.
    let depth = 1;
    let k = m.index + m[0].length;
    const start = k;
    for (; k < code.length && depth > 0; k++) {
      if (code[k] === "(") depth++;
      else if (code[k] === ")") depth--;
    }
    const args = code.slice(start, k - 1);
    for (const s of args.matchAll(/(["'`])((?:(?!\1).)*)\1/g)) {
      const value = s[2] ?? "";
      if (ONLINE_RE.test(value) && !found.includes(value)) found.push(value);
    }
  }
  return found;
}
