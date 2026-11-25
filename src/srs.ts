/**
 * Spaced-repetition state for flashcard decks (docs/specs/flashcards.md).
 *
 * Study progress is APP state, never document state: it lives in
 * localStorage keyed by document + deck + card-content-hash + the
 * local author name, so a teacher/student file stays byte-identical
 * (invariant #2 untouched) and each user keeps private progress.
 * Editing a card changes its content hash, which resets that card's
 * schedule - correct, because the card changed.
 *
 * The scheduler is a small SM-2: Again/Hard/Good/Easy with an ease
 * factor and a millisecond interval per card.
 */
import type { Doc } from "@folio/engine/doc";

export interface SrsEntry {
  /** Epoch ms when the card is due again. */
  due: number;
  /** Current interval in ms. */
  interval: number;
  /** SM-2 ease factor. */
  ease: number;
}

export type SrsGrade = "again" | "hard" | "good" | "easy";

type Store = Record<string, Record<string, Record<string, SrsEntry>>>;

const KEY = "folio-flash-srs";
/** The same localStorage key main.ts keeps the comment author under. */
const AUTHOR_KEY = "folio-author";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/** A card's identity for scheduling: its content, so an edit resets it. */
export function cardHash(front: string, back?: string, sound?: string): string {
  return djb2(`${front}\n${back ?? ""}\n${sound ?? ""}`);
}

/** A stable-enough document identity for local progress: the
 *  frontmatter comment (the app pointer), the title heading, and the
 *  deck ids - NOT the card text, which changes as decks are edited. */
export function docKey(doc: Doc): string {
  const firstHeading = doc.blocks.find((b) => b.kind === "heading");
  const decks = doc.blocks
    .filter((b) => b.kind === "flashcards")
    .map((b) => (b.kind === "flashcards" ? b.flashcards.id : ""))
    .join(",");
  return djb2(
    `${doc.frontmatter.comment ?? ""}\n${
      firstHeading?.kind === "heading" ? firstHeading.text : ""
    }\n${decks}`,
  );
}

function author(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || "local";
  } catch {
    return "local";
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Store;
  } catch {
    // A corrupt store is not worth losing a document over.
  }
  return {};
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked: study mode still works in-session.
  }
}

function bucket(
  store: Store,
  docK: string,
  deckId: string,
  who: string,
): Record<string, SrsEntry> {
  const d = (store[docK] ??= {});
  const k = `${deckId}/${who}`;
  return (d[k] ??= {});
}

/** How many of the deck's cards are due now (the label-strip badge). */
export function dueCount(
  doc: Doc,
  deckId: string,
  hashes: string[],
  now = Date.now(),
): number {
  const store = load();
  const cards = store[docKey(doc)]?.[`${deckId}/${author()}`];
  // No grades yet: every card is due (new cards start due).
  if (!cards) return hashes.length;
  let n = 0;
  for (const h of hashes) {
    const e = cards[h];
    // A card never graded is due (new cards start due).
    if (!e || e.due <= now) n += 1;
  }
  return n;
}

/** Record a grade; returns the entry written. */
export function grade(
  doc: Doc,
  deckId: string,
  hash: string,
  g: SrsGrade,
  now = Date.now(),
): SrsEntry {
  const store = load();
  const cards = bucket(store, docKey(doc), deckId, author());
  const prev = cards[hash];
  const interval = prev?.interval ?? 0;
  let ease = prev?.ease ?? 2.5;
  let next: number;
  switch (g) {
    case "again":
      next = MINUTE;
      ease = Math.max(1.3, ease - 0.2);
      break;
    case "hard":
      next = Math.max(10 * MINUTE, Math.round(interval * 1.2));
      ease = Math.max(1.3, ease - 0.15);
      break;
    case "good":
      next = interval === 0 ? DAY : Math.round(interval * ease);
      break;
    case "easy":
      next = interval === 0 ? 4 * DAY : Math.round(interval * ease * 1.3);
      ease += 0.15;
      break;
  }
  const entry: SrsEntry = { due: now + next, interval: next, ease };
  cards[hash] = entry;
  save(store);
  return entry;
}

/** The interval label shown on a grade button ("1m", "10m", "1d"…). */
export function intervalLabel(ms: number): string {
  if (ms < MINUTE) return "<1m";
  if (ms < 60 * MINUTE) return `${String(Math.round(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))}h`;
  return `${Math.round(ms / DAY)}d`;
}
