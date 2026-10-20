/**
 * The signal-processing walkthrough document (demo/examples/
 * signal-processing.md) is the math catalog's proof of work: a
 * 64-sample two-tone signal, its DFT and FFT spectra, and a
 * one-pole low-pass filter - all formula columns. This test pins
 * the document to the physics it describes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc, type DocBlock } from "@folio/engine/doc";
import { recalcTable } from "@folio/engine/recalc";

const doc = parseDoc(
  readFileSync(
    join(import.meta.dirname, "../../demo/examples/signal-processing.md"),
    "utf8",
  ),
);

const signalTable = doc.blocks.find(
  (b): b is Extract<DocBlock, { kind: "table" }> =>
    b.kind === "table" && b.table.id === "signal",
)?.table;

const col = (name: string): number =>
  signalTable?.columns.findIndex((c) => c.name === name) ?? -1;

const out = signalTable ? recalcTable(signalTable) : undefined;

describe("demo: signal-processing walkthrough", () => {
  it("parses and round-trips byte-identically", () => {
    expect(serializeDoc(doc)).toBe(
      readFileSync(
        join(import.meta.dirname, "../../demo/examples/signal-processing.md"),
        "utf8",
      ),
    );
  });

  it("has the signal table with ten columns and 64 rows", () => {
    expect(signalTable?.columns.length).toBe(10);
    expect(signalTable?.rows.length).toBe(64);
  });

  it("recalcs every formula column without error", () => {
    expect(out).toBeDefined();
    const formulas = signalTable?.columns.filter((c) => c.type === "formula");
    for (const c of formulas ?? []) {
      const i = signalTable?.columns.indexOf(c) ?? -1;
      out?.rows.forEach((row) => {
        expect(row[i]).not.toBe("");
      });
    }
  });

  it("peaks at 5 Hz and 20 Hz with the amplitudes the DFT promises", () => {
    const mag = out?.rows.map((r) => (r[col("mag")] as number) ?? 0) ?? [];
    // N/2 times each tone's amplitude: 32 and 0.6 * 32.
    expect(mag[5]).toBeCloseTo(32, 9);
    expect(mag[20]).toBeCloseTo(19.2, 9);
    // Everything off the tones (and their mirrors) is zero.
    expect(mag[10]).toBeCloseTo(0, 9);
    expect(mag[32]).toBeCloseTo(0, 9);
  });

  it("the FFT column agrees with the per-bin DFT column", () => {
    out?.rows.forEach((row) => {
      expect(row[col("fftmag")]).toBeCloseTo(row[col("mag")] as number, 9);
    });
  });

  it("the low-pass filter attenuates exactly as its recurrence says", () => {
    // Recompute the filtered signal and its spectrum independently
    // (test-local DFT) and pin the engine's lpmag to it - transient
    // included, since the DFT window sees the whole signal.
    const sig = out?.rows.map((r) => (r[col("sig")] as number) ?? 0) ?? [];
    const lp: number[] = [];
    sig.forEach((x, i) => {
      lp.push(i === 0 ? x : 0.2 * x + 0.8 * (lp[i - 1] ?? 0));
    });
    const dftMag = (xs: number[], k: number): number => {
      let re = 0;
      let im = 0;
      xs.forEach((x, n) => {
        const a = (-2 * Math.PI * k * n) / xs.length;
        re += x * Math.cos(a);
        im += x * Math.sin(a);
      });
      return Math.hypot(re, im);
    };
    const lpmag = out?.rows.map((r) => (r[col("lpmag")] as number) ?? 0) ?? [];
    [5, 20, 32].forEach((k) => {
      // The column rounds to six decimals (the same transform
      // the catalog ships), so the expectation rounds too.
      expect(lpmag[k]).toBeCloseTo(Number(dftMag(lp, k).toFixed(6)), 9);
    });
    // Steady-state expectation: the 20 Hz tone is crushed far
    // harder than the 5 Hz tone (|H| ~ 0.13 vs ~ 0.42).
    const lpmag5 = lpmag[5] ?? Number.NaN;
    const lpmag20 = lpmag[20] ?? Number.NaN;
    expect(lpmag20 / lpmag5).toBeLessThan(0.4);
  });

  it("the EMA recurrence produces the classic settling curve", () => {
    // y1 = x1 (first row seeds with the signal), then the
    // recurrence blends. For a constant input it settles toward
    // the input; here the signal oscillates, so just pin rows
    // 1-3 against the recurrence computed by hand.
    const lp = out?.rows.map((r) => (r[col("lp")] as number) ?? 0) ?? [];
    const sig = out?.rows.map((r) => (r[col("sig")] as number) ?? 0) ?? [];
    expect(lp[0]).toBeCloseTo(sig[0] ?? 0, 12);
    expect(lp[1]).toBeCloseTo(0.2 * (sig[1] ?? 0) + 0.8 * (lp[0] ?? 0), 12);
    expect(lp[2]).toBeCloseTo(0.2 * (sig[2] ?? 0) + 0.8 * (lp[1] ?? 0), 12);
  });
});
