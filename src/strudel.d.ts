/**
 * Minimal type surface for @strudel/web (v1.3.0 ships no TypeScript
 * declarations). Only the API folio uses: one-time setup, pattern
 * evaluation, and stopping all playback (ADR-0014).
 */
declare module "@strudel/web" {
  export interface StrudelWeb {
    initStrudel(options?: unknown): Promise<unknown>;
    evaluate(code: string): Promise<unknown>;
    hush(): void;
  }
  const strudel: StrudelWeb;
  export = strudel;
}
