import { describe, it, expect } from "vitest";
import { ComparatorService } from "../../src/services/grading/comparator.service";
import { NormalizerService } from "../../src/services/grading/normalizer.service";
import type { QueryResult } from "../../src/services/sandbox/execution.service";

const actual = (rows: Record<string, unknown>[]) =>
  NormalizerService.normalizeQueryResult({
    columns: rows[0] ? Object.keys(rows[0]) : [],
    rows,
    rowCount: rows.length,
    executionTime: 1,
  } as QueryResult);

describe("ComparatorService.compare (table)", () => {
  it("passes when rows match regardless of order", () => {
    const expected = NormalizerService.normalizeExpectedOutput({
      type: "table",
      value: [{ id: 2 }, { id: 1 }],
    });
    const result = ComparatorService.compare(actual([{ id: 1 }, { id: 2 }]), expected, "table");
    expect(result.passed).toBe(true);
  });

  it("fails with a descriptive reason on row count mismatch", () => {
    const expected = NormalizerService.normalizeExpectedOutput({ type: "table", value: [{ id: 1 }] });
    const result = ComparatorService.compare(actual([{ id: 1 }, { id: 2 }]), expected, "table");
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/rows/i);
  });

  it("fails on column mismatch even with matching row count", () => {
    const expected = NormalizerService.normalizeExpectedOutput({ type: "table", value: [{ id: 1 }] });
    const result = ComparatorService.compare(actual([{ name: "x" }]), expected, "table");
    expect(result.passed).toBe(false);
  });
});

describe("ComparatorService.compare (single_value)", () => {
  it("passes on an exact scalar match", () => {
    const expected = NormalizerService.normalizeExpectedOutput({ type: "single_value", value: 42 });
    const result = ComparatorService.compare(actual([{ value: 42 }]), expected, "single_value");
    expect(result.passed).toBe(true);
  });
});

describe("ComparatorService.compare (count)", () => {
  it("passes when counts match", () => {
    const expected = NormalizerService.normalizeExpectedOutput({ type: "count", value: 3 });
    const result = ComparatorService.compare(actual([{ count: 3 }]), expected, "count");
    expect(result.passed).toBe(true);
  });
});

describe("ComparatorService.compare (unsupported type)", () => {
  it("fails closed on an unknown comparison type rather than passing", () => {
    const expected = NormalizerService.normalizeExpectedOutput({ type: "count", value: 1 });
    const result = ComparatorService.compare(actual([{ count: 1 }]), expected, "not_a_real_type");
    expect(result.passed).toBe(false);
  });
});
