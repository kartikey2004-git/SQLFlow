import { describe, it, expect } from "vitest";
import { NormalizerService } from "../../src/services/grading/normalizer.service";
import type { QueryResult } from "../../src/services/sandbox/execution.service";

const queryResult = (rows: Record<string, unknown>[]): QueryResult => ({
  columns: rows[0] ? Object.keys(rows[0]) : [],
  rows,
  rowCount: rows.length,
  executionTime: 1,
});

describe("NormalizerService.normalizeQueryResult", () => {
  it("treats null and undefined consistently", () => {
    const result = NormalizerService.normalizeQueryResult(
      queryResult([{ a: null }, { a: undefined }]),
    );
    expect(result.rows.every((r) => r.a === null)).toBe(true);
  });

  it("does not misgrade numeric-looking strings with leading zeros as numbers", () => {
    // "007" is a plausible student-submitted zip/employee code - it must not
    // silently become the number 7 (that was the pre-fix bug).
    const result = NormalizerService.normalizeQueryResult(queryResult([{ code: "007" }]));
    expect(result.rows[0]!.code).toBe("007");
  });

  it("rounds floating point values to a fixed precision", () => {
    const result = NormalizerService.normalizeQueryResult(queryResult([{ v: 1 / 3 }]));
    expect(result.rows[0]!.v).toBeCloseTo(0.333333, 6);
  });

  it("sorts rows deterministically regardless of input order", () => {
    const a = NormalizerService.normalizeQueryResult(queryResult([{ id: 2 }, { id: 1 }]));
    const b = NormalizerService.normalizeQueryResult(queryResult([{ id: 1 }, { id: 2 }]));
    expect(a.rows).toEqual(b.rows);
  });

  it("normalizes column key casing", () => {
    const result = NormalizerService.normalizeQueryResult(queryResult([{ Name: "Bob" }]));
    expect(result.columns).toContain("name");
  });
});

describe("NormalizerService.normalizeExpectedOutput", () => {
  it("handles the table type", () => {
    const result = NormalizerService.normalizeExpectedOutput({
      type: "table",
      value: [{ id: 1, name: "Alice" }],
    });
    expect(result.rowCount).toBe(1);
    expect(result.columns).toEqual(["id", "name"]);
  });

  it("handles the count type", () => {
    const result = NormalizerService.normalizeExpectedOutput({ type: "count", value: 5 });
    expect(result.rows[0]!.count).toBe(5);
  });

  it("sorts column values for order-insensitive comparison", () => {
    const result = NormalizerService.normalizeExpectedOutput({
      type: "column",
      value: [3, 1, 2],
    });
    expect(result.rows.map((r) => r.value)).toEqual([1, 2, 3]);
  });
});
