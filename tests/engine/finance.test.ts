import { describe, expect, it } from "vitest";
import {
  addMonths,
  dayNumber,
  looksLikeDates,
  monthsBetween,
  toIso,
} from "../../src/engine/dates";
import {
  cagr,
  fv,
  ipmt,
  irr,
  nper,
  npv,
  pmt,
  ppmt,
  pv,
  rate,
} from "../../src/engine/finance";
import {
  recalcTable,
  spreadsheetHabits,
  unaryMinus,
} from "../../src/engine/recalc";
import type { Table } from "../../src/engine/index";

/** Rounded to cents (or `p` places), as the spreadsheets show them. */
const r = (x: number, p = 2): number => Number(x.toFixed(p));

describe("finance functions (docs/specs/formulas.md) - spreadsheet values", () => {
  it("pmt / fv / pv / nper / rate", () => {
    expect(r(pmt(0.045 / 12, 300, 250000))).toBe(-1389.58);
    expect(r(pmt(0, 10, 1000))).toBe(-100);
    // Excel's documented examples.
    expect(r(fv(0.05 / 12, 120, -100))).toBe(15528.23);
    expect(r(pv(0.08 / 12, 240, 500))).toBe(-59777.15);
    expect(r(nper(0.01, -100, 1000), 4)).toBe(10.5886);
    expect(r(rate(48, -200, 8000), 6)).toBe(0.007701);
  });

  it("ipmt / ppmt split a payment; npv / irr / cagr", () => {
    expect(r(ipmt(0.1 / 12, 1, 36, 8000))).toBe(-66.67);
    expect(r(ppmt(0.1 / 12, 1, 24, 2000))).toBe(-75.62);
    // Interest + principal = the payment, every period.
    const p = pmt(0.045 / 12, 300, 250000);
    expect(
      r(
        ipmt(0.045 / 12, 120, 300, 250000) + ppmt(0.045 / 12, 120, 300, 250000),
        6,
      ),
    ).toBe(r(p, 6));
    expect(r(npv(0.1, -10000, 3000, 4200, 6800))).toBe(1188.44);
    expect(r(irr([-70000, 12000, 15000, 18000, 21000, 26000]), 4)).toBe(0.0866);
    expect(Number.isNaN(irr([100, 200]))).toBe(true);
    expect(r(cagr(100, 200, 10), 4)).toBe(0.0718);
  });
});

describe("dates", () => {
  it("reads the shapes public data uses, as ISO", () => {
    expect(toIso("2024-03-31")).toBe("2024-03-31");
    expect(toIso("2024-03-31T00:00:00Z")).toBe("2024-03-31");
    expect(toIso("2024-03")).toBe("2024-03-01");
    expect(toIso("31 Mar 2024")).toBe("2024-03-31"); // Bank of England
    expect(toIso("31-Mar-2024")).toBe("2024-03-31");
    expect(toIso("2024 MAR")).toBe("2024-03-01"); // ONS months
    expect(toIso("March 2024")).toBe("2024-03-01");
    expect(toIso("03/04/2024")).toBeNull(); // ambiguous: not read
    expect(toIso("2024-02-30")).toBeNull();
    expect(looksLikeDates(["2024-01-01", "", "2024-02-01"])).toBe(true);
    expect(looksLikeDates(["2024", "2025"])).toBe(false);
  });

  it("moves by months as EDATE does, and counts between", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-01-15", -13)).toBe("2022-12-15");
    expect(addMonths("2024-01-15", 0, true)).toBe("2024-01-31");
    expect(monthsBetween("2020-01-15", "2021-01-14")).toBe(11);
    expect(monthsBetween("2020-01-15", "2021-01-15")).toBe(12);
    expect(dayNumber("1970-01-02")).toBe(1);
  });
});

describe("unary minus (Jexl has it only on number literals)", () => {
  it("rewrites -X as (0 - X) and leaves binary minus alone", () => {
    expect(unaryMinus("-pmt(0.1, 3, 100)")).toBe("(0 - pmt(0.1, 3, 100))");
    expect(unaryMinus("2 * -f(3)")).toBe("2 * (0 - f(3))");
    expect(unaryMinus("-(2+3)")).toBe("(0 - (2+3))");
    expect(unaryMinus("f(-a, -self.prev.b)")).toBe(
      "f((0 - a), (0 - self.prev.b))",
    );
    expect(unaryMinus("a ? -b : -c")).toBe("a ? (0 - b) : (0 - c)");
    expect(unaryMinus("1 - -x")).toBe("1 - (0 - x)");
    for (const same of ["-3", "5 - 3", "5 -3", "a - b", "1 - -2", "'-x' + y"]) {
      expect(unaryMinus(same)).toBe(same);
    }
  });
});

describe("spreadsheet habits", () => {
  it("reads =, upper-case functions and percentages as meant", () => {
    expect(spreadsheetHabits("=PMT(4.5%/12, 300, 250000)")).toBe(
      "pmt((4.5 / 100)/12, 300, 250000)",
    );
    expect(spreadsheetHabits("x * 20% + Round(y, 2)")).toBe(
      "x * (20 / 100) + round(y, 2)",
    );
    // Modulo stays modulo; strings stay as written; == is not "=".
    for (const same of ["10 % 3", "10%3", "a%b", "'4.5%' + PMT", "a == b"]) {
      expect(spreadsheetHabits(same)).toBe(same);
    }
  });

  it("a formula typed the spreadsheet way computes", () => {
    const t: Table = {
      id: "t",
      columns: [
        { name: "pay", type: "formula", expr: "=-PMT(4.5%/12, 25*12, 250000)" },
      ],
      rows: [[""]],
    };
    expect(r(Number(recalcTable(t).rows[0]?.[0]))).toBe(1389.58);
  });

  it("an unknown function says so", () => {
    const t: Table = {
      id: "t",
      columns: [{ name: "x", type: "formula", expr: "vlookup(1, 2, 3)" }],
      rows: [[""]],
    };
    expect(() => recalcTable(t)).toThrow(/unknown function 'vlookup'/);
  });
});

describe("formulas over money and time", () => {
  const prices: Table = {
    id: "ftse",
    columns: [
      { name: "date", type: "date" },
      { name: "close", type: "number" },
    ],
    rows: [
      ["2024-01-01", 100],
      ["2024-02-01", 104],
      ["2024-03-01", 103],
    ],
  };
  const pool = (id: string): Table | undefined =>
    id === "ftse" ? prices : undefined;

  it("a repayment schedule from pmt and a running balance", () => {
    const loan: Table = {
      id: "loan",
      columns: [
        { name: "month", type: "number" },
        {
          name: "payment",
          type: "formula",
          expr: "-pmt(0.045 / 12, 300, 250000)",
        },
        {
          name: "balance",
          type: "formula",
          expr: "(self.row == 1 ? 250000 : self.prev.balance) * (1 + 0.045 / 12) - payment",
        },
      ],
      rows: Array.from({ length: 300 }, (_, i) => [i + 1, "", ""]),
    };
    const out = recalcTable(loan);
    expect(r(Number(out.rows[0]?.[1]))).toBe(1389.58);
    // Paid off after the last payment.
    expect(Math.abs(Number(out.rows[299]?.[2]))).toBeLessThan(0.01);
  });

  it("date columns read as ISO text; dates compute; asof looks up a price", () => {
    const plan: Table = {
      id: "plan",
      columns: [
        { name: "start", type: "date" },
        { name: "when", type: "formula", expr: "edate(start, self.row - 1)" },
        { name: "yr", type: "formula", expr: "year(when)" },
        {
          name: "price",
          type: "formula",
          expr: "asof(when, @ftse.col.date, @ftse.col.close)",
        },
        {
          name: "exact",
          type: "formula",
          expr: "xlookup(when, @ftse.col.date, @ftse.col.close)",
        },
      ],
      rows: [
        ["2024-01-15", "", "", "", ""],
        ["2024-01-15", "", "", "", ""],
        ["2024-01-15", "", "", "", ""],
        ["2023-12-15", "", "", "", ""],
      ],
    };
    const out = recalcTable(plan, pool);
    expect(out.rows.map((row) => row[1])).toEqual([
      "2024-01-15",
      "2024-02-15",
      "2024-03-15",
      "2024-03-15",
    ]);
    expect(out.rows[0]?.[2]).toBe(2024);
    // On or before: 15 Feb reads 1 Feb's price.
    expect(out.rows.map((row) => row[3])).toEqual([100, 104, 103, 103]);
    // Exact: no price on the 15th.
    expect(out.rows[0]?.[4]).toBe("");
  });

  it("names the problem with a cross-table column", () => {
    const bad: Table = {
      id: "bad",
      columns: [{ name: "x", type: "formula", expr: "@ftse.col.nope | sum()" }],
      rows: [[""]],
    };
    expect(() => recalcTable(bad, pool)).toThrow(/unknown column 'nope'/);
  });
});
