import { describe, expect, it } from "vitest";
import { midiToHz, notesFromAbc } from "@folio/audio/tone-synth";

describe("tone synth", () => {
  it("MIDI 69 is A4 = 440 Hz; an octave doubles", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });

  it("abcjs whole-note timing becomes seconds at the tune's tempo", () => {
    const notes = notesFromAbc(
      [
        [
          { cmd: "note", pitch: 67, start: 0, duration: 0.25, volume: 100 },
          { cmd: "note", pitch: 69, start: 0.25, duration: 0.5, volume: 90 },
          { cmd: "text" },
        ],
      ],
      120,
    );
    // 120 quarter notes a minute: a whole note is 2 s.
    expect(notes).toEqual([
      { pitch: 67, start: 0, duration: 0.5, volume: 100 },
      { pitch: 69, start: 0.5, duration: 1, volume: 90 },
    ]);
  });
});
