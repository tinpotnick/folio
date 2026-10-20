/**
 * Minimal type surface for @strudel/web (v1.3.0 ships no TypeScript
 * declarations). Only the API folio uses: one-time setup, pattern
 * evaluation, stopping all playback, and the REPL state and pattern
 * query that drive the playing highlight (ADR-0014).
 */
declare module "@strudel/web" {
  /** One source-code location a hap was caused by. */
  export interface StrudelLocation {
    start: number;
    end: number;
  }
  /** A cycle position (a Fraction at runtime; Number() reads it). */
  export type StrudelTime = { valueOf(): number };
  export interface StrudelHap {
    whole?: { begin: StrudelTime; end: StrudelTime };
    context?: { locations?: StrudelLocation[] } & Record<string, unknown>;
  }
  export interface StrudelPattern {
    /** The haps active in the cycle span [begin, end). */
    queryArc(begin: number, end: number): StrudelHap[];
  }
  export interface StrudelScheduler {
    /** The current cycle position; 0 when not started. */
    now(): number;
  }
  export interface StrudelReplState {
    /** The evaluated pattern now playing. */
    pattern?: StrudelPattern;
    /** Every mini-notation atom's [start, end) source range. */
    miniLocations: Array<[number, number]>;
  }
  export interface StrudelRepl {
    scheduler: StrudelScheduler;
    state: StrudelReplState;
  }
  export interface StrudelInitOptions {
    /** The caller's AudioContext (created in the play gesture). */
    audioContext?: AudioContext | undefined;
    /** Called with evaluation errors (evaluate() does not reject). */
    onEvalError?: (e: unknown) => void;
    /** Awaited by setup after the default synth sounds register. */
    prebake?: () => Promise<unknown>;
  }
  export interface StrudelWeb {
    initStrudel(options?: StrudelInitOptions): Promise<StrudelRepl>;
    evaluate(code: string): Promise<unknown>;
    hush(): void;
    /** Register sample sounds: name -> URLs (index = n). */
    samples(map: Record<string, string[]>, baseUrl?: string): Promise<void>;
    /** Fetch + decode one sample URL into strudel's buffer cache. */
    loadBuffer(url: string, ctx: BaseAudioContext): Promise<AudioBuffer>;
    /** The AudioContext strudel plays through. */
    getAudioContext(): AudioContext;
  }
  const strudel: StrudelWeb;
  export = strudel;
}
