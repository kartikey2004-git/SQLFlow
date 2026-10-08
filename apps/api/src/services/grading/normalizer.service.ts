import type { TableResult as QueryResult } from "../sandbox/tableResult";

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

  private static normalizeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      const num = Number(trimmed);
      if (trimmed !== "" && !isNaN(num) && String(num) === trimmed) {
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

  private static normalizeRow(row: any): NormalizedRow {
    if (typeof row !== "object" || row === null) {
      return row;
    }

    const normalized: NormalizedRow = {};

    const sortedKeys = Object.keys(row)
      .map((key) => key.toLowerCase())
      .sort();

    for (const key of sortedKeys) {
      const originalKey = Object.keys(row).find((k) => k.toLowerCase() === key);
      if (originalKey) {
        normalized[key] = this.normalizeValue(row[originalKey]);
      }
    }

    return normalized;
  }

  static normalizeQueryResult(result: QueryResult): NormalizedResult {
    const normalizedRows = result.rows.map((row) => this.normalizeRow(row));

    normalizedRows.sort((a, b) => {
      const aStr = JSON.stringify(a, Object.keys(a).sort());
      const bStr = JSON.stringify(b, Object.keys(b).sort());
      return aStr.localeCompare(bStr);
    });

    const columns = Array.from(
      new Set(normalizedRows.flatMap((row) => Object.keys(row))),
    ).sort();

    return {
      rows: normalizedRows,
      columns,
      rowCount: normalizedRows.length,
    };
  }

  static normalizeExpectedOutput(
    expectedOutput: ExpectedOutput,
  ): NormalizedResult {
    const { type, value } = expectedOutput;

    switch (type) {
      case "table": {
        const tableRows = Array.isArray(value) ? value : [];
        const normalizedTableRows = tableRows.map((row) =>
          this.normalizeRow(row),
        );

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
        const normalizedValue = this.normalizeValue(value);
        const singleRow: NormalizedRow = { value: normalizedValue };

        return {
          rows: [singleRow],
          columns: ["value"],
          rowCount: 1,
        };
      }

      case "column": {
        const columnValues = Array.isArray(value) ? value : [];
        const normalizedColumnValues = columnValues.map((val) =>
          this.normalizeValue(val),
        );
        const columnRows: NormalizedRow[] = normalizedColumnValues.map(
          (val) => ({ value: val }),
        );

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
