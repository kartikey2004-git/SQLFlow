/**
 * Idempotency support for retried pg-boss jobs (see worker.ts + prompt.md
 * §13). pg-boss redelivers the SAME job id on retry rather than minting a
 * new one, so `job.id` is a natural idempotency key: `submissions` and
 * `query_executions` each get a nullable, uniquely-indexed `job_id` column.
 * Repositories use `INSERT ... ON CONFLICT (job_id) DO NOTHING` and fetch
 * the existing row on conflict, so a retried job reuses its original row
 * instead of creating a duplicate submission/grade/log entry.
 *
 * Direct (non-queue) callers - e.g. the integration tests that call
 * ExecutionService/GradingService straight, without going through pg-boss -
 * omit job_id entirely and keep today's plain-INSERT behavior unchanged.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("submissions", {
    job_id: { type: "uuid" },
  });
  pgm.createIndex("submissions", "job_id", {
    name: "submissions_job_id_unique_idx",
    unique: true,
    where: "job_id IS NOT NULL",
  });

  pgm.addColumn("query_executions", {
    job_id: { type: "uuid" },
  });
  pgm.createIndex("query_executions", "job_id", {
    name: "query_executions_job_id_unique_idx",
    unique: true,
    where: "job_id IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("query_executions", "job_id", { name: "query_executions_job_id_unique_idx" });
  pgm.dropColumn("query_executions", "job_id");
  pgm.dropIndex("submissions", "job_id", { name: "submissions_job_id_unique_idx" });
  pgm.dropColumn("submissions", "job_id");
};
