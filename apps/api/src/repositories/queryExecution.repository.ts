import { pool } from "@sql-learn/database";

export type QueryExecutionStatus = "success" | "error" | "timeout";

export const QueryExecutionRepository = {
  /**
   * Logs one query execution. When called with a `jobId` (queue-driven
   * executions), the insert is deduped via `ON CONFLICT (job_id) DO
   * NOTHING` so a pg-boss retry of the same job can't produce a second log
   * row for one execution (see migrations/1700000000006). Direct callers
   * (tests calling ExecutionService without the queue) omit jobId and keep
   * the previous plain-INSERT behavior.
   */
  async log(data: {
    attemptId: number;
    sqlText: string;
    status: QueryExecutionStatus;
    errorMessage?: string | null;
    rowCount?: number | null;
    durationMs?: number | null;
    jobId?: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO query_executions (attempt_id, sql_text, status, error_message, row_count, duration_ms, job_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ${data.jobId ? "ON CONFLICT (job_id) WHERE job_id IS NOT NULL DO NOTHING" : ""}`,
      [
        data.attemptId,
        data.sqlText,
        data.status,
        data.errorMessage ?? null,
        data.rowCount ?? null,
        data.durationMs ?? null,
        data.jobId ?? null,
      ],
    );
  },
};
