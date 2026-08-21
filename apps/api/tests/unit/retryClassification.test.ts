import { describe, it, expect } from "vitest";
import { ExecutionService, ExecutionServiceError } from "../../src/services/sandbox/execution.service";

/**
 * Regression suite for prompt.md §14: unrecognized Postgres errors must
 * default to *retryable* (rethrown, unwrapped) so pg-boss retries genuine
 * infra failures, while known "the student's query did this" errors must
 * stay non-retryable (wrapped as ExecutionServiceError, reported to the
 * student). Before this fix, every unrecognized code silently became
 * non-retryable RUNTIME_ERROR.
 */
describe("ExecutionService.convertPostgresError retry classification", () => {
  const nonRetryableCases: { code: string; message: string; expectedType: string }[] = [
    { code: "57014", message: "canceling statement due to statement timeout", expectedType: "TIMEOUT" },
    { code: "42601", message: "syntax error at or near", expectedType: "SYNTAX_ERROR" },
    { code: "42703", message: 'column "x" does not exist', expectedType: "RUNTIME_ERROR" },
    { code: "42P01", message: 'relation "x" does not exist', expectedType: "RUNTIME_ERROR" },
    { code: "42501", message: "permission denied for table x", expectedType: "PERMISSION_ERROR" },
    { code: "22012", message: "division by zero", expectedType: "RUNTIME_ERROR" },
    { code: "23505", message: "duplicate key value violates unique constraint", expectedType: "RUNTIME_ERROR" },
  ];

  for (const { code, message, expectedType } of nonRetryableCases) {
    it(`classifies ${code} (${message}) as non-retryable (${expectedType})`, () => {
      const result = ExecutionService.convertPostgresError({ code, message });
      expect(result).toBeInstanceOf(ExecutionServiceError);
      expect(result.type).toBe(expectedType);
    });
  }

  const retryableCases: { code?: string; message: string; label: string }[] = [
    { code: "08006", message: "connection failure", label: "connection exception (class 08)" },
    { code: "08003", message: "connection does not exist", label: "connection does not exist" },
    { code: "53300", message: "too many connections", label: "insufficient resources (class 53)" },
    { code: "40001", message: "serialization failure", label: "serialization failure (class 40)" },
    { code: "57P01", message: "terminating connection due to administrator command", label: "admin shutdown" },
    { code: undefined, message: "socket hang up", label: "bare JS/network error with no SQLSTATE" },
  ];

  for (const { code, message, label } of retryableCases) {
    it(`rethrows ${label} unwrapped so pg-boss retries it`, () => {
      expect(() => ExecutionService.convertPostgresError({ code, message })).toThrow();
      try {
        ExecutionService.convertPostgresError({ code, message });
      } catch (thrown) {
        // Rethrown as-is, not wrapped into an ExecutionServiceError (which
        // worker.ts treats as a terminal, non-retryable job outcome).
        expect(thrown).not.toBeInstanceOf(ExecutionServiceError);
      }
    });
  }
});
