import { describe, it, expect } from "vitest";
import { LeakDetectionService } from "../../src/services/hints/leakDetection.service";

describe("LeakDetectionService.check", () => {
  it("flags a hint containing a full SELECT...FROM shape", () => {
    const result = LeakDetectionService.check("Try: SELECT name FROM employees WHERE salary > 50000", null);
    expect(result.leaked).toBe(true);
  });

  it("allows a conceptual hint with no SQL shape", () => {
    const result = LeakDetectionService.check(
      "Think about which aggregate function counts rows per group.",
      "SELECT department, COUNT(*) FROM employees GROUP BY department",
    );
    expect(result.leaked).toBe(false);
  });

  it("flags a hint that heavily overlaps the reference solution", () => {
    const solution = "SELECT department, COUNT(*) AS total FROM employees GROUP BY department ORDER BY total DESC";
    const nearVerbatim = "department count total employees group department order total desc";
    const result = LeakDetectionService.check(nearVerbatim, solution);
    expect(result.leaked).toBe(true);
  });

  it("does not flag when there is no reference solution to compare against", () => {
    const result = LeakDetectionService.check("Consider grouping by department.", null);
    expect(result.leaked).toBe(false);
  });
});
