// Minimal typings for nspell (the package ships none). Only the API
// folio's spell checker uses (spec: docs/specs/spellcheck-grammar.md).
declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
    remove(word: string): void;
    wordCharacters(): string;
  }
  function nspell(aff: string | Uint8Array, dic: string | Uint8Array): NSpell;
  export = nspell;
}
