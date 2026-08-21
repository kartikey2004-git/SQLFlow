import { pool } from "@sql-learn/database";

export type ExpectedOutputType = "table" | "single_value" | "column" | "row" | "count";

export interface TestCaseRow {
  id: number;
  assignment_id: number;
  name: string | null;
  expected_output_type: ExpectedOutputType;
  expected_output: unknown;
  is_hidden: boolean;
  weight: string; // numeric comes back as string from pg
  order_index: number;
}

export const TestCaseRepository = {
  /** All test cases (visible + hidden) - grading only, never sent to the client as-is. */
  async findByAssignmentId(assignmentId: number): Promise<TestCaseRow[]> {
    const result = await pool.query<TestCaseRow>(
      `SELECT * FROM test_cases WHERE assignment_id = $1 ORDER BY order_index ASC, id ASC`,
      [assignmentId],
    );
    return result.rows;
  },

  /** Visible-only, safe to expose in assignment detail responses. */
  async findVisibleByAssignmentId(assignmentId: number): Promise<TestCaseRow[]> {
    const result = await pool.query<TestCaseRow>(
      `SELECT * FROM test_cases
       WHERE assignment_id = $1 AND is_hidden = false
       ORDER BY order_index ASC, id ASC`,
      [assignmentId],
    );
    return result.rows;
  },
};
