/**
 * Three-way line merge (diff3) - spec: docs/specs/save-conflicts.md.
 * Pure computation, zero UI dependencies (ADR-0001/0007): the host
 * calls merge3(base, ours, theirs) on the canonical markdown and gets
 * chunks; conflicts are structured hunks, never marker lines, so no
 * conflict text can leak into a saved file.
 */

export type MergeChunk =
  | { type: "same"; lines: string[] }
  | { type: "only-ours"; lines: string[] }
  | { type: "only-theirs"; lines: string[] }
  | { type: "conflict"; base: string[]; ours: string[]; theirs: string[] };

export type ConflictChunk = Extract<MergeChunk, { type: "conflict" }>;

/** A change from base to another version: base[start, end) is
 *  replaced by `lines` (start === end for a pure insertion). */
interface Change {
  start: number;
  end: number;
  lines: string[];
}

/** Myers O(ND) diff as matching pairs (i in a, j in b), ascending.
 *  Capped: past the cap the whole range is one change (a conflict),
 *  never a hang - documents are small, but a hostile pair must not
 *  spin the save path. */
function matches(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  // Past the cap: one sentinel match, i.e. the whole range is a single
  // change (a conflict at merge time), never a hang.
  if (max > 8000) return [[n, m]];
  const size = 2 * max + 3;
  const off = max + 1;
  let v = new Int32Array(size).fill(-1);
  v[off + 1] = 0;
  const trace: Int32Array[] = [];
  // Int32Array reads are number|undefined under noUncheckedIndexedAccess.
  const at = (arr: Int32Array, i: number): number => arr[i] ?? -1;
  let found = -1;
  for (let d = 0; d <= max && found < 0; d++) {
    trace.push(v);
    const next = new Int32Array(size).fill(-1);
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && at(v, off + k - 1) < at(v, off + k + 1))) {
        x = at(v, off + k + 1);
      } else {
        x = at(v, off + k - 1) + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      next[off + k] = x;
      if (x >= n && y >= m) found = d;
    }
    v = next;
  }
  if (found < 0) return [[n, m]];
  // Backtrack.
  const out: Array<[number, number]> = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const vv = trace[d] as Int32Array;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && at(vv, off + k - 1) < at(vv, off + k + 1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = at(vv, off + prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push([x - 1, y - 1]);
      x--;
      y--;
    }
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    out.push([x - 1, y - 1]);
    x--;
    y--;
  }
  return out.reverse();
}

/** The changes that turn `a` into `b`. */
function diffChanges(a: string[], b: string[]): Change[] {
  const pairs = matches(a, b);
  const changes: Change[] = [];
  let i = 0;
  let j = 0;
  for (const [mi, mj] of [...pairs, [a.length, b.length] as [number, number]]) {
    if (mi > i || mj > j)
      changes.push({ start: i, end: mi, lines: b.slice(j, mj) });
    i = mi + 1;
    j = mj + 1;
  }
  return changes;
}

interface Region {
  start: number;
  end: number;
  ours: Change[];
  theirs: Change[];
}

/**
 * merge3(base, ours, theirs): the chunks of a three-way merge. A
 * region touched by both sides - overlapping or directly adjacent,
 * with no unchanged line between, as in git merge-file - is a
 * conflict chunk; one side only takes its lines; untouched lines are
 * "same".
 */
export function merge3(
  base: string,
  ours: string,
  theirs: string,
): MergeChunk[] {
  const b = base.split("\n");
  const o = ours.split("\n");
  const t = theirs.split("\n");
  const regions: Region[] = [];
  const add = (c: Change, side: "ours" | "theirs"): void => {
    const hit = regions.find((r) => c.start <= r.end && r.start <= c.end);
    if (hit) {
      hit.start = Math.min(hit.start, c.start);
      hit.end = Math.max(hit.end, c.end);
      hit[side].push(c);
    } else {
      regions.push({
        start: c.start,
        end: c.end,
        ours: side === "ours" ? [c] : [],
        theirs: side === "theirs" ? [c] : [],
      });
    }
  };
  for (const c of diffChanges(b, o)) add(c, "ours");
  for (const c of diffChanges(b, t)) add(c, "theirs");
  regions.sort((r1, r2) => r1.start - r2.start || r1.end - r2.end);
  // Re-merge regions that grew into each other.
  const merged: Region[] = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
      last.ours.push(...r.ours);
      last.theirs.push(...r.theirs);
    } else {
      merged.push(r);
    }
  }
  const linesOf = (cs: Change[]): string[] =>
    cs
      .slice()
      .sort((c1, c2) => c1.start - c2.start)
      .flatMap((c) => c.lines);
  const chunks: MergeChunk[] = [];
  let pos = 0;
  for (const r of merged) {
    if (r.start > pos)
      chunks.push({ type: "same", lines: b.slice(pos, r.start) });
    const oursLines = linesOf(r.ours);
    const theirsLines = linesOf(r.theirs);
    if (r.ours.length > 0 && r.theirs.length > 0) {
      // Both changed the same region the SAME way: not a conflict.
      if (oursLines.join("\n") === theirsLines.join("\n")) {
        chunks.push({ type: "only-ours", lines: oursLines });
      } else {
        chunks.push({
          type: "conflict",
          base: b.slice(r.start, r.end),
          ours: oursLines,
          theirs: theirsLines,
        });
      }
    } else if (r.ours.length > 0) {
      chunks.push({ type: "only-ours", lines: oursLines });
    } else {
      chunks.push({ type: "only-theirs", lines: theirsLines });
    }
    pos = r.end;
  }
  if (pos < b.length) chunks.push({ type: "same", lines: b.slice(pos) });
  return chunks;
}

export function conflictsOf(chunks: MergeChunk[]): ConflictChunk[] {
  return chunks.filter((c): c is ConflictChunk => c.type === "conflict");
}

/** Render chunks to text, resolving each conflict as chosen. */
export function mergeText(
  chunks: MergeChunk[],
  resolve: (c: ConflictChunk) => "ours" | "theirs",
): string {
  const out: string[] = [];
  for (const ch of chunks) {
    if (ch.type === "same") out.push(...ch.lines);
    else if (ch.type === "only-ours") out.push(...ch.lines);
    else if (ch.type === "only-theirs") out.push(...ch.lines);
    else out.push(...(resolve(ch) === "ours" ? ch.ours : ch.theirs));
  }
  return out.join("\n");
}
