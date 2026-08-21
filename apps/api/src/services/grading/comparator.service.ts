import type { NormalizedResult } from "./normalizer.service";

export interface ComparisonResult {
  passed: boolean;
  reason: string | null;
}

export class ComparatorService {
  /**
   * Compare two normalized values deeply
   */
  private static compareValues(actual: any, expected: any): boolean {
    // Handle null/undefined consistently
    if (actual === null && expected === null) return true;
    if (actual === null || expected === null) return false;
    if (actual === undefined && expected === undefined) return true;
    if (actual === undefined || expected === undefined) return false;

    // Direct comparison for primitives
    if (typeof actual !== "object" || typeof expected !== "object") {
      return actual === expected;
    }

    // Both are objects - compare keys and values
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();

    if (actualKeys.length !== expectedKeys.length) return false;

    for (let i = 0; i < actualKeys.length; i++) {
      const actualKey = actualKeys[i];
      const expectedKey = expectedKeys[i];
      if (!actualKey || !expectedKey) return false;
      if (actualKey !== expectedKey) return false;
      if (!this.compareValues(actual[actualKey]!, expected[expectedKey]!)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compare table results (type: "table")
   */
  private static compareTable(
    actual: NormalizedResult,
    expected: NormalizedResult,
  ): ComparisonResult {
    // Check row count
    if (actual.rowCount !== expected.rowCount) {
      return {
        passed: false,
        reason: `Expected ${expected.rowCount} rows but got ${actual.rowCount}`,
      };
    }

    // Check column count and names
    const actualColumns = [...actual.columns].sort();
    const expectedColumns = [...expected.columns].sort();

    if (actualColumns.length !== expectedColumns.length) {
      return {
        passed: false,
        reason: `Expected ${expectedColumns.length} columns but got ${actualColumns.length}`,
      };
    }

    for (let i = 0; i < actualColumns.length; i++) {
      if (actualColumns[i] !== expectedColumns[i]) {
        return {
          passed: false,
          reason: `Column mismatch: expected column '${expectedColumns[i]}' but got '${actualColumns[i]}'`,
        };
      }
    }

    // Compare each row
    for (let i = 0; i < actual.rowCount; i++) {
      if (!this.compareValues(actual.rows[i], expected.rows[i])) {
        return {
          passed: false,
          reason: `Row ${i + 1} values do not match expected output`,
        };
      }
    }

    return { passed: true, reason: null };
  }

  /**
   * Compare single value results (type: "single_value")
   */
  private static compareSingleValue(
    actual: NormalizedResult,
    expected: NormalizedResult,
  ): ComparisonResult {
    if (actual.rowCount !== 1) {
      return {
        passed: false,
        reason: `Expected exactly 1 row but got ${actual.rowCount}`,
      };
    }

    if (actual.columns.length !== 1) {
      return {
        passed: false,
        reason: `Expected exactly 1 column but got ${actual.columns.length}`,
      };
    }

    if (!this.compareValues(actual.rows[0]?.value, expected.rows[0]?.value)) {
      return {
        passed: false,
        reason: `Value '${actual.rows[0]?.value}' does not match expected '${expected.rows[0]?.value}'`,
      };
    }

    return { passed: true, reason: null };
  }

  /**
   * Compare column results (type: "column")
   */
  private static compareColumn(
    actual: NormalizedResult,
    expected: NormalizedResult,
  ): ComparisonResult {
    if (actual.columns.length !== 1) {
      return {
        passed: false,
        reason: `Expected exactly 1 column but got ${actual.columns.length}`,
      };
    }

    if (actual.rowCount !== expected.rowCount) {
      return {
        passed: false,
        reason: `Expected ${expected.rowCount} values but got ${actual.rowCount}`,
      };
    }

    // Compare each value (rows are already sorted)
    for (let i = 0; i < actual.rowCount; i++) {
      if (!this.compareValues(actual.rows[i]?.value, expected.rows[i]?.value)) {
        return {
          passed: false,
          reason: `Value at position ${i + 1} '${actual.rows[i]?.value}' does not match expected '${expected.rows[i]?.value}'`,
        };
      }
    }

    return { passed: true, reason: null };
  }

  /**
   * Compare row results (type: "row")
   */
  private static compareRow(
    actual: NormalizedResult,
    expected: NormalizedResult,
  ): ComparisonResult {
    if (actual.rowCount !== 1) {
      return {
        passed: false,
        reason: `Expected exactly 1 row but got ${actual.rowCount}`,
      };
    }

    const actualColumns = [...actual.columns].sort();
    const expectedColumns = [...expected.columns].sort();

    if (actualColumns.length !== expectedColumns.length) {
      return {
        passed: false,
        reason: `Expected ${expectedColumns.length} columns but got ${actual.columns.length}`,
      };
    }

    // Check column names match
    for (let i = 0; i < actualColumns.length; i++) {
      if (actualColumns[i] !== expectedColumns[i]) {
        return {
          passed: false,
          reason: `Column mismatch: expected column '${expectedColumns[i]}' but got '${actualColumns[i]}'`,
        };
      }
    }

    // Compare row values
    if (!this.compareValues(actual.rows[0], expected.rows[0])) {
      return {
        passed: false,
        reason: `Row values do not match expected output`,
      };
    }

    return { passed: true, reason: null };
  }

  /**
   * Compare count results (type: "count")
   */
  private static compareCount(
    actual: NormalizedResult,
    expected: NormalizedResult,
  ): ComparisonResult {
    if (!this.compareValues(actual.rows[0]?.count, expected.rows[0]?.count)) {
      return {
        passed: false,
        reason: `Expected count ${expected.rows[0]?.count} but got ${actual.rows[0]?.count}`,
      };
    }

    return { passed: true, reason: null };
  }

  /**
   * Main comparison function
   */
  static compare(
    actual: NormalizedResult,
    expected: NormalizedResult,
    type: string,
  ): ComparisonResult {
    switch (type) {
      case "table":
        return this.compareTable(actual, expected);

      case "single_value":
        return this.compareSingleValue(actual, expected);

      case "column":
        return this.compareColumn(actual, expected);

      case "row":
        return this.compareRow(actual, expected);

      case "count":
        return this.compareCount(actual, expected);

      default:
        return {
          passed: false,
          reason: `Unsupported comparison type: ${type}`,
        };
    }
  }
}
