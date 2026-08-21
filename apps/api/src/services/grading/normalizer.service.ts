import type { QueryResult } from "../sandbox/execution.service";

export interface ExpectedOutput {
  type: string;
  value: unknown;
}

export interface NormalizedRow {
  [key: string]: any;
}

export interface NormalizedResult {
  rows: NormalizedRow[];
  columns: string[];
  rowCount: number;
}

export class NormalizerService {
  private static readonly FLOAT_PRECISION = 6;

  /**
   * Normalize a single value
   */
  private static normalizeValue(value: any): any {
    // Handle null/undefined consistently
    if (value === null || value === undefined) {
      return null;
    }

    // Convert numeric strings to numbers
    if (typeof value === "string") {
      // Trim whitespace
      const trimmed = value.trim();

      // Only coerce when the string is *exactly* how JS would print that
      // number back out - rejects things like "007" or "1_000", which are
      // legitimate non-numeric-typed values (codes, IDs) that would
      // otherwise silently misgrade as their numeric value.
      const num = Number(trimmed);
      if (trimmed !== "" && !isNaN(num) && String(num) === trimmed) {
        // Round floating numbers to fixed precision
        if (Number.isFinite(num) && !Number.isInteger(num)) {
          return (
            Math.round(num * Math.pow(10, this.FLOAT_PRECISION)) /
            Math.pow(10, this.FLOAT_PRECISION)
          );
        }
        return num;
      }

      return trimmed;
    }

    // Handle numbers - round floating point
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      !Number.isInteger(value)
    ) {
      return (
        Math.round(value * Math.pow(10, this.FLOAT_PRECISION)) /
        Math.pow(10, this.FLOAT_PRECISION)
      );
    }

    return value;
  }

  /**
   * Normalize a single row
   */
  private static normalizeRow(row: any): NormalizedRow {
    if (typeof row !== "object" || row === null) {
      return row;
    }

    const normalized: NormalizedRow = {};

    // Convert all keys to lowercase and sort them alphabetically
    const sortedKeys = Object.keys(row)
      .map((key) => key.toLowerCase())
      .sort();

    for (const key of sortedKeys) {
      // Find the original key that matches this lowercase key
      const originalKey = Object.keys(row).find((k) => k.toLowerCase() === key);
      if (originalKey) {
        normalized[key] = this.normalizeValue(row[originalKey]);
      }
    }

    return normalized;
  }

  /**
   * Normalize query result for comparison
   */
  static normalizeQueryResult(result: QueryResult): NormalizedResult {
    const normalizedRows = result.rows.map((row) => this.normalizeRow(row));

    // Sort rows deterministically using JSON string comparison
    normalizedRows.sort((a, b) => {
      const aStr = JSON.stringify(a, Object.keys(a).sort());
      const bStr = JSON.stringify(b, Object.keys(b).sort());
      return aStr.localeCompare(bStr);
    });

    // Get all unique columns from normalized rows
    const columns = Array.from(
      new Set(normalizedRows.flatMap((row) => Object.keys(row))),
    ).sort();

    return {
      rows: normalizedRows,
      columns,
      rowCount: normalizedRows.length,
    };
  }

  /**
   * Normalize expected output based on type
   */
  static normalizeExpectedOutput(
    expectedOutput: ExpectedOutput,
  ): NormalizedResult {
    const { type, value } = expectedOutput;

    switch (type) {
      case "table": {
        // Value is an array of objects
        const tableRows = Array.isArray(value) ? value : [];
        const normalizedTableRows = tableRows.map((row) =>
          this.normalizeRow(row),
        );

        // Sort rows deterministically
        normalizedTableRows.sort((a, b) => {
          const aStr = JSON.stringify(a, Object.keys(a).sort());
          const bStr = JSON.stringify(b, Object.keys(b).sort());
          return aStr.localeCompare(bStr);
        });

        const tableColumns = Array.from(
          new Set(normalizedTableRows.flatMap((row) => Object.keys(row))),
        ).sort();

        return {
          rows: normalizedTableRows,
          columns: tableColumns,
          rowCount: normalizedTableRows.length,
        };
      }

      case "single_value": {
        // Value is a single value
        const normalizedValue = this.normalizeValue(value);
        const singleRow: NormalizedRow = { value: normalizedValue };

        return {
          rows: [singleRow],
          columns: ["value"],
          rowCount: 1,
        };
      }

      case "column": {
        // Value is an array of values
        const columnValues = Array.isArray(value) ? value : [];
        const normalizedColumnValues = columnValues.map((val) =>
          this.normalizeValue(val),
        );
        const columnRows: NormalizedRow[] = normalizedColumnValues.map(
          (val) => ({ value: val }),
        );

        // Sort values for order-insensitive comparison
        columnRows.sort((a, b) => {
          const aVal = a.value;
          const bVal = b.value;

          if (aVal === null && bVal === null) return 0;
          if (aVal === null) return -1;
          if (bVal === null) return 1;

          if (typeof aVal === "number" && typeof bVal === "number") {
            return aVal - bVal;
          }

          return String(aVal).localeCompare(String(bVal));
        });

        return {
          rows: columnRows,
          columns: ["value"],
          rowCount: columnRows.length,
        };
      }

      case "row": {
        // Value is a single object
        const rowValue =
          typeof value === "object" && value !== null ? value : {};
        const normalizedRow = this.normalizeRow(rowValue);

        return {
          rows: [normalizedRow],
          columns: Object.keys(normalizedRow).sort(),
          rowCount: 1,
        };
      }

      case "count": {
        // Value is just a number
        const countValue = this.normalizeValue(value);
        const countRow: NormalizedRow = { count: countValue };

        return {
          rows: [countRow],
          columns: ["count"],
          rowCount: 1,
        };
      }

      default:
        throw new Error(`Unsupported expected output type: ${type}`);
    }
  }
}
