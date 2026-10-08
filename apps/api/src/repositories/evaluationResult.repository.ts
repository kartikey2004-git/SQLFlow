import { pool } from "@sql-learn/database";

export interface EvaluationResultRow {
  id: number;
  submission_id: number;
  test_case_id: number;
  passed: boolean;
  details: unknown;
  created_at: Date;
}

export const EvaluationResultRepository = {
  async bulkInsert(
    submissionId: number,
    results: { testCaseId: number; passed: boolean; details?: unknown }[],
  ): Promise<void> {
    if (results.length === 0) return;

    const values: unknown[] = [];
    const rows = results.map((r, i) => {
      values.push(submissionId, r.testCaseId, r.passed, r.details ? JSON.stringify(r.details) : null);
      const base = i * 4;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    await pool.query(
      `INSERT INTO evaluation_results (submission_id, test_case_id, passed, details)
       VALUES ${rows.join(", ")}`,
      values,
    );
  },

  async bulkUpsert(
    submissionId: number,
    results: { testCaseId: number; passed: boolean; details?: unknown }[],
  ): Promise<void> {
    if (results.length === 0) return;

    const values: unknown[] = [];
    const rows = results.map((r, i) => {
      values.push(submissionId, r.testCaseId, r.passed, r.details ? JSON.stringify(r.details) : null);
      const base = i * 4;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    await pool.query(
      `INSERT INTO evaluation_results (submission_id, test_case_id, passed, details)
       VALUES ${rows.join(", ")}
       ON CONFLICT (submission_id, test_case_id)
       DO UPDATE SET passed = EXCLUDED.passed, details = EXCLUDED.details`,
      values,
    );
  },

  async findBySubmissionId(submissionId: number): Promise<EvaluationResultRow[]> {
    const result = await pool.query<EvaluationResultRow>(
      `SELECT * FROM evaluation_results WHERE submission_id = $1 ORDER BY id ASC`,
      [submissionId],
    );
    return result.rows;
  },
};