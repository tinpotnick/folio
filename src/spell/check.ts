/**
 * Bundled spell check (spec: docs/specs/spellcheck-grammar.md,
 * ADR-0033): nspell (MIT) over the vendored Hunspell en_US dictionary
 * (src/assets/dict/, SCOWL/wordlist - BSD-style permissive licence,
 * see LICENSE.en_US.txt there). The dictionary is a build asset
 * (imported with ?url) fetched lazily on first use, so it ships in
 * the bundle and works fully offline - including in WebKitGTK/Tauri,
 * where the native spell checker is unavailable without system
 * dictionaries. Deterministic across OSes, so it is testable.
 */

import nspell from "nspell";
import affUrl from "../assets/dict/en_US.aff?url";
import dicUrl from "../assets/dict/en_US.dic?url";

export type SpellChecker = ReturnType<typeof nspell>;
type Spell = SpellChecker;

let instance: Spell | null = null;
let loading: Promise<Spell | null> | null = null;

const CUSTOM_KEY = "folio.spellcheck.custom.v1";

function loadCustom(): Set<string> {
  try {
    return new Set<string>(
      (JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]") as string[]).map(
        (w) => w.toLowerCase(),
      ),
    );
  } catch {
    return new Set<string>();
  }
}

const customWords = loadCustom();

/** The spell checker if already loaded (null while loading) - for
 * synchronous contexts like the context-menu handler. */
export function spellNow(): Spell | null {
  return instance;
}

/** The spell checker, loading the dictionary on first call. Null when
 * the dictionary cannot be loaded (no marks then, gracefully). */
export function spellReady(): Promise<Spell | null> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      try {
        const [aff, dic] = await Promise.all([
          fetch(affUrl).then((r) => r.text()),
          fetch(dicUrl).then((r) => r.text()),
        ]);
        const s = nspell(aff, dic);
        for (const w of customWords) s.add(w);
        instance = s;
        return s;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

/** Words worth checking: letters/digits with inner apostrophes
 * ("don't"), unicode-aware. */
export const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function isMisspelled(s: Spell, word: string): boolean {
  if (customWords.has(word.toLowerCase())) return false;
  return !s.correct(word);
}

export function suggestions(s: Spell, word: string): string[] {
  return s.suggest(word).slice(0, 8);
}

/** Add to the user's custom dictionary (persisted per origin). */
export function addCustomWord(word: string): void {
  const w = word.toLowerCase();
  if (customWords.has(w)) return;
  customWords.add(w);
  instance?.add(word);
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([...customWords]));
  } catch {
    // private mode etc. - the word just lives for this session
  }
}
