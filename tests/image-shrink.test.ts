import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_DIM,
  TARGET_EMBED_BYTES,
  shrinkPlan,
} from "../src/image-shrink";

/**
 * Image downscaling on embed (spec: docs/specs/images.md): a pasted
 * photo is shrunk so its data URI stays a sane source line. The sizing
 * decision is pure and tested here; the canvas re-encode is covered by
 * e2e (tests/e2e/images.spec.ts) and WebKitGTK (image-paste-switch-fast).
 */

describe("shrinkPlan", () => {
  it("downscales so the longest edge fits the cap, keeping aspect", () => {
    expect(shrinkPlan(4000, 3000)).toEqual({
      width: MAX_IMAGE_DIM,
      height: Math.round((3000 * MAX_IMAGE_DIM) / 4000),
    });
    expect(shrinkPlan(3000, 4000).height).toBe(MAX_IMAGE_DIM);
    expect(shrinkPlan(5000, 500)).toEqual({
      width: MAX_IMAGE_DIM,
      height: 205,
    });
  });

  it("never upscales and keeps small images as-is", () => {
    expect(shrinkPlan(1000, 500)).toEqual({ width: 1000, height: 500 });
    expect(shrinkPlan(MAX_IMAGE_DIM, MAX_IMAGE_DIM)).toEqual({
      width: MAX_IMAGE_DIM,
      height: MAX_IMAGE_DIM,
    });
  });

  it("degenerate sizes clamp to 1px", () => {
    expect(shrinkPlan(0, 0)).toEqual({ width: 1, height: 1 });
  });

  it("the embed target is a few hundred KB, not megabytes", () => {
    expect(TARGET_EMBED_BYTES).toBeLessThanOrEqual(500_000);
    expect(MAX_IMAGE_DIM).toBeLessThanOrEqual(2560);
  });
});
