import { describe, expect, it } from "vitest";
import { formatComputed } from "@folio/render/number";

describe("formatComputed", () => {
  it("caps a float at six decimals and trims trailing zeros", () => {
    expect(formatComputed(0.0062132653273250064)).toBe("0.006213");
    expect(formatComputed(1.0099354660765056)).toBe("1.009935");
    expect(formatComputed(0.001953125)).toBe("0.001953");
    expect(formatComputed(15.465554)).toBe("15.465554");
    expect(formatComputed(0.5)).toBe("0.5");
  });

  it("leaves integers and non-numbers alone", () => {
    expect(formatComputed(256)).toBe("256");
    expect(formatComputed(-256)).toBe("-256");
    expect(formatComputed("North")).toBe("North");
    expect(formatComputed(undefined)).toBe("");
  });

  it("never shows a non-zero value as zero", () => {
    expect(formatComputed(1.234e-9)).toBe("1.23e-9");
    expect(formatComputed(-4e-8)).toBe("-4e-8");
    expect(formatComputed(-1e-7 + 1e-7)).toBe("0");
  });

  it("does not print negative zero", () => {
    expect(formatComputed(-0.0000004)).toBe("-4e-7");
    expect(formatComputed(-0.0000000001 * 0)).toBe("0");
  });

  it("keeps the percent format", () => {
    expect(formatComputed(0.2160194, "percent")).toBe("21.6%");
  });
});
