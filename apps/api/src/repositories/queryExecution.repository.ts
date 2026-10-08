import { pool } from "@sql-learn/database";

export type QueryExecutionStatus = "success" | "error" | "timeout";

export const QueryExecutionRepository = {
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