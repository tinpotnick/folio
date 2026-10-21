import { describe, expect, it } from "vitest";
import { bindVegaData, vegaDataRefs } from "@folio/render/vega-data";

const rows = [{ region: "North", growth: 0.2 }];
const lookup = (id: string) => (id === "regional-data" ? rows : undefined);

describe("Vega-Lite data binding", () => {
  it("replaces @dataset references with the rows, at any depth", () => {
    const spec = {
      layer: [
        { data: { name: "@regional-data" }, mark: "bar" },
        {
          data: { name: "@regional-data", format: { type: "json" } },
          mark: "rule",
        },
      ],
    };
    expect(vegaDataRefs(spec)).toEqual(["regional-data"]);
    const bound = bindVegaData(spec, lookup) as {
      layer: { data: Record<string, unknown> }[];
    };
    expect(bound.layer[0]?.data).toEqual({ values: rows });
    expect(bound.layer[1]?.data).toEqual({
      format: { type: "json" },
      values: rows,
    });
  });

  it("leaves inline values and plain names alone", () => {
    const spec = { data: { values: [{ a: 1 }] }, mark: "point" };
    expect(bindVegaData(spec, lookup)).toEqual(spec);
    expect(bindVegaData({ data: { name: "table" } }, lookup)).toEqual({
      data: { name: "table" },
    });
  });

  it("refuses URL data (offline) and unknown datasets, saying why", () => {
    expect(() =>
      bindVegaData({ data: { url: "https://example.com/d.csv" } }, lookup),
    ).toThrow(/render offline/);
    expect(() => bindVegaData({ data: { name: "@nope" } }, lookup)).toThrow(
      /no dataset @nope/,
    );
  });
});
