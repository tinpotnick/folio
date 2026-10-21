/**
 * folio's offline note synth (spec: docs/specs/drawn-blocks.md,
 * "ABC music"): plays a note sequence with Web Audio oscillators - no
 * samples, no soundfonts, nothing downloaded. Plain rather than
 * piano-like, by design.
 */

export interface SynthNote {
  /** MIDI note number (69 = A4). */
  pitch: number;
  /** Seconds from the start. */
  start: number;
  /** Seconds. */
  duration: number;
  /** 0..127 */
  volume: number;
}

export const midiToHz = (pitch: number): number =>
  440 * Math.pow(2, (pitch - 69) / 12);

/**
 * Notes from abcjs's audio description: `start`/`duration` are in
 * WHOLE notes; `tempo` is quarter notes per minute.
 */
export function notesFromAbc(
  tracks: {
    cmd: string;
    pitch?: number;
    start?: number;
    duration?: number;
    volume?: number;
  }[][],
  tempo: number,
): SynthNote[] {
  const secPerWhole = 240 / (tempo > 0 ? tempo : 120);
  const out: SynthNote[] = [];
  for (const track of tracks) {
    for (const e of track) {
      if (e.cmd !== "note" || e.pitch === undefined) continue;
      out.push({
        pitch: e.pitch,
        start: (e.start ?? 0) * secPerWhole,
        duration: Math.max(0.05, (e.duration ?? 0.25) * secPerWhole),
        volume: e.volume ?? 90,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** A playing sequence: stop() silences it at once. */
export interface Playback {
  stop(): void;
  /** Seconds until the last note ends. */
  length: number;
}

export function playNotes(ctx: AudioContext, notes: SynthNote[]): Playback {
  const t0 = ctx.currentTime + 0.08;
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  const oscs: OscillatorNode[] = [];
  let length = 0;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midiToHz(n.pitch);
    const env = ctx.createGain();
    const at = t0 + n.start;
    const peak = (n.volume / 127) * 0.9;
    const end = at + n.duration;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.012);
    env.gain.exponentialRampToValueAtTime(
      Math.max(peak * 0.55, 0.0001),
      at + 0.18,
    );
    env.gain.setValueAtTime(
      Math.max(peak * 0.55, 0.0001),
      Math.max(at + 0.18, end - 0.06),
    );
    env.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(end + 0.1);
    oscs.push(osc);
    length = Math.max(length, n.start + n.duration + 0.2);
  }
  return {
    length,
    stop: () => {
      for (const o of oscs) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      }
      master.disconnect();
    },
  };
}
