/**
 * Minimal type surface for @strudel/web (v1.3.0 ships no TypeScript
 * declarations). Only the API folio uses: one-time setup, pattern
 * evaluation, stopping all playback, and the per-event trigger hook
 * that drives the playing highlight (ADR-0014).
 */
declare module "@strudel/web" {
  /** One source-code location a hap was caused by. */
  export interface StrudelLocation {
    start: number;
    end: number;
  }
  export interface StrudelHap {
    context?: { locations?: StrudelLocation[] } & Record<string, unknown>;
  }
  export interface StrudelPattern {
    /** false keeps the default webaudio output audible. */
    onTrigger(
      cb: (hap: StrudelHap) => void,
      dominant?: boolean,
    ): StrudelPattern;
  }
  export interface StrudelScheduler {
    /** The current cycle position; 0 when not started. */
    now(): number;
  }
  export interface StrudelRepl {
    scheduler: StrudelScheduler;
  }
  export interface StrudelInitOptions {
    /** Receives the compiled pattern before scheduling. */
    editPattern?: (pattern: StrudelPattern) => StrudelPattern;
  }
  export interface StrudelWeb {
    initStrudel(options?: StrudelInitOptions): Promise<StrudelRepl>;
    evaluate(code: string): Promise<unknown>;
    hush(): void;
  }
  const strudel: StrudelWeb;
  export = strudel;
}
