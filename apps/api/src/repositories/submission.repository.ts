import { pool } from "@sql-learn/database";

export type SubmissionStatus = "pending" | "evaluating" | "completed" | "failed";

export interface SubmissionRow {
  id: number;
  attempt_id: number;
  sql_text: string;
  status: SubmissionStatus;
  passed: boolean | null;
  score: string | null; // numeric comes back as string from pg
  execution_time_ms: number | null;
  row_count: number | null;
  error_message: string | null;
  submitted_at: Date;
  job_id: string | null;
}

export const SubmissionRepository = {
  /**
   * Creates a submission row, or - when called with a `jobId` from a
   * pg-boss job - returns the row already created by an earlier delivery of
   * that same job instead of inserting a duplicate. Retried jobs keep the
   * same `job.id`, so `ON CONFLICT (job_id) DO NOTHING` + re-fetch is enough
   * to make submission creation idempotent (see migrations/1700000000006).
   * Direct callers (tests calling GradingService without going through the
   * queue) omit jobId and get the previous plain-INSERT behavior.
   */
  async create(data: { attemptId: number; sqlText: string; jobId?: string }): Promise<SubmissionRow> {
    if (data.jobId) {
      const inserted = await pool.query<SubmissionRow>(
        `INSERT INTO submissions (attempt_id, sql_text, status, job_id)
         VALUES ($1, $2, 'evaluating', $3)
         ON CONFLICT (job_id) WHERE job_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [data.attemptId, data.sqlText, data.jobId],
      );
      if (inserted.rows[0]) return inserted.rows[0];

      const existing = await this.findByJobId(data.jobId);
      if (!existing) {
        // Conflict fired but a concurrent transaction hasn't committed its
        // row yet - vanishingly unlikely (jobs for a given user are
        // singleton-keyed), but fail loudly rather than silently creating a
        // duplicate.
        throw new Error(`submissions.job_id conflict for ${data.jobId} but no row found`);
      }
      return existing;
    }

    const result = await pool.query<SubmissionRow>(
      `INSERT INTO submissions (attempt_id, sql_text, status)
       VALUES ($1, $2, 'evaluating')
       RETURNING *`,
      [data.attemptId, data.sqlText],
    );
    return result.rows[0]!;
  },

  async findByJobId(jobId: string): Promise<SubmissionRow | null> {
    const result = await pool.query<SubmissionRow>(`SELECT * FROM submissions WHERE job_id = $1`, [
      jobId,
    ]);
    return result.rows[0] ?? null;
  },

  async updateResult(
    id: number,
    result: {
      status: SubmissionStatus;
      passed?: boolean | null;
      score?: number | null;
      executionTimeMs?: number | null;
      rowCount?: number | null;
      errorMessage?: string | null;
    },
  ): Promise<SubmissionRow> {
    const updated = await pool.query<SubmissionRow>(
      `UPDATE submissions
       SET status = $2, passed = $3, score = $4, execution_time_ms = $5,
           row_count = $6, error_message = $7
       WHERE id = $1
       RETURNING *`,
      [
        id,
        result.status,
        result.passed ?? null,
        result.score ?? null,
        result.executionTimeMs ?? null,
        result.rowCount ?? null,
        result.errorMessage ?? null,
      ],
    );
    return updated.rows[0]!;
  },

  async findById(id: number): Promise<SubmissionRow | null> {
    const result = await pool.query<SubmissionRow>(`SELECT * FROM submissions WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ?? null;
  },

  /**
   * Submissions still "evaluating" past `cutoff` - the worker that owned
   * them crashed (or was killed) between marking them evaluating and
   * persisting a result. Reconciliation target for CleanupService (see
   * prompt.md §16 - "never leave submissions permanently stuck in
   * running").
   */
  async findStaleEvaluating(cutoff: Date): Promise<SubmissionRow[]> {
    const result = await pool.query<SubmissionRow>(
      `SELECT * FROM submissions WHERE status = 'evaluating' AND submitted_at < $1`,
      [cutoff],
    );
    return result.rows;
  },
};
