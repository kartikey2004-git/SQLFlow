import { pool } from "@sql-learn/database";
import { auth } from "@sql-learn/auth";
import { CleanupService } from "../../src/services/cleanup/cleanup.service";

let counter = 0;
const unique = () => `${Date.now()}_${++counter}`;

export const createTestUser = async (overrides: { password?: string } = {}) => {
  const password = overrides.password ?? "password123";
  const email = `test_${unique()}@example.com`;
  const { user } = await auth.api.signUpEmail({
    body: { email, password, name: "Test User" },
  });
  return { user: { id: Number(user.id), email: user.email, displayName: "Test User" }, email, password };
};

export interface TestAssignmentOptions {
  solutionSql?: string;
  hiddenTestCase?: boolean;
}

/**
 * Creates a minimal single-table assignment with one visible test case
 * (and optionally one hidden one), matching the shape SandboxService
 * expects in `sample_tables`.
 */
export const createTestAssignment = async (options: TestAssignmentOptions = {}) => {
  const title = `Test Assignment ${unique()}`;
  const sampleTables = [
    {
      tableName: "widgets",
      columns: [
        { columnName: "id", dataType: "INTEGER" },
        { columnName: "price", dataType: "INTEGER" },
      ],
      rows: [
        { id: 1, price: 10 },
        { id: 2, price: 25 },
        { id: 3, price: 40 },
      ],
    },
  ];

  const assignmentResult = await pool.query<{ id: number }>(
    `INSERT INTO assignments (title, question, difficulty, sample_tables, solution_sql)
     VALUES ($1, $2, 'easy', $3, $4)
     RETURNING id`,
    [title, "Find widgets priced over 20", JSON.stringify(sampleTables), options.solutionSql ?? null],
  );
  const assignmentId = assignmentResult.rows[0]!.id;

  await pool.query(
    `INSERT INTO test_cases (assignment_id, name, expected_output_type, expected_output, is_hidden, order_index)
     VALUES ($1, 'Visible case', 'table', $2, false, 0)`,
    [assignmentId, JSON.stringify([{ id: 2, price: 25 }, { id: 3, price: 40 }])],
  );

  if (options.hiddenTestCase) {
    await pool.query(
      `INSERT INTO test_cases (assignment_id, name, expected_output_type, expected_output, is_hidden, order_index)
       VALUES ($1, 'Hidden case', 'count', $2, true, 1)`,
      [assignmentId, JSON.stringify(2)],
    );
  }

  return { assignmentId, title };
};

export const cleanupTestData = async () => {
  // Child tables (attempts, submissions, ...) cascade from these deletes,
  // but the Postgres sandbox *schemas* those attempts provisioned don't -
  // sweep them via CleanupService so repeated test runs don't accumulate
  // orphaned `sb_*` schemas.
  await pool.query(`DELETE FROM assignments WHERE title LIKE 'Test Assignment %'`);
  await pool.query(`DELETE FROM users WHERE email LIKE 'test_%@example.com'`);
  await CleanupService.cleanupOrphanedSchemas();
};
