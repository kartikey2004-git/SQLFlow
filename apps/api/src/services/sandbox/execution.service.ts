import pg from "pg";
import type { QueryResult } from "@sql-learn/types";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { QueryExecutionRepository } from "../../repositories/queryExecution.repository";
import { SandboxService } from "./sandbox.service";
import { ScriptDeadline, runScript } from "./scriptRunner";
import { roleUrlForDb, studentRole } from "./sandboxDb";
import { queryExecutionDuration, queryTimeoutTotal } from "../../utils/metrics";

const { Client } = pg;

export type ExecutionErrorType = "SANDBOX_NOT_FOUND" | "QUOTA_EXCEEDED";

export class ExecutionServiceError extends Error {
  constructor(
    public readonly type: ExecutionErrorType,
    message: string,
  ) {
    super(message);
  }
}

export const SCRIPT_TIMEOUT_MS = Number(process.env.SANDBOX_SCRIPT_TIMEOUT_MS ?? 15_000);
const MAX_DB_BYTES = Number(process.env.SANDBOX_MAX_DB_BYTES ?? 200 * 1024 * 1024);
const GRACE_MS = 1_000;

export async function withStudentConnection<T>(
  role: string,
  db: string,
  fn: (client: pg.Client, deadline: ScriptDeadline) => Promise<T>,
  timeoutMs = SCRIPT_TIMEOUT_MS,
): Promise<T> {
  const client = new Client({
    connectionString: roleUrlForDb(role, db),
    connectionTimeoutMillis: 5_000,
    application_name: "sqlflow-student",
  });
  client.on("error", () => {
  });
  try {
    await client.connect();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "3D000" || code === "28000" || code === "28P01") {
      throw new ExecutionServiceError(
        "SANDBOX_NOT_FOUND",
        "Your sandbox database is missing. Reset your sandbox and try again.",
      );
    }
    throw e;
  }

  const deadline = new ScriptDeadline();
  const pid = (client as unknown as { processID: number }).processID;
  let killTimer: NodeJS.Timeout | undefined;
  const cancelTimer = setTimeout(() => {
    deadline.timedOut = true;
    void SandboxService.cancelBackend(pid, false).catch(() => {});
    killTimer = setTimeout(() => void SandboxService.cancelBackend(pid, true).catch(() => {}), GRACE_MS);
  }, timeoutMs);
  try {
    return await fn(client, deadline);
  } finally {
    clearTimeout(cancelTimer);
    if (killTimer) clearTimeout(killTimer);
    await client.end().catch(() => {});
  }
}

export class ExecutionService {
  static async executeQuery(
    userId: number,
    assignmentId: number,
    query: string,
    jobId?: string,
  ): Promise<QueryResult> {
    const attempt = await AttemptRepository.findByUserAndAssignment(userId, assignmentId);
    if (!attempt?.sandbox_db) {
      throw new ExecutionServiceError(
        "SANDBOX_NOT_FOUND",
        "Sandbox not found for this assignment. Please initialize the sandbox first.",
      );
    }

    if ((await SandboxService.databaseSize(attempt.sandbox_db)) > MAX_DB_BYTES) {
      throw new ExecutionServiceError(
        "QUOTA_EXCEEDED",
        "Your sandbox is over its storage limit. Reset your sandbox to continue.",
      );
    }

    const result = await withStudentConnection(studentRole(userId), attempt.sandbox_db, (client, deadline) =>
      runScript(client, query, deadline),
    );

    const failed = result.statements.find((s) => s.error);
    const timedOut = failed?.error?.code === "57014";
    queryExecutionDuration.observe(
      { status: timedOut ? "timeout" : failed ? "error" : "success" },
      result.executionTime / 1000,
    );
    if (timedOut) queryTimeoutTotal.inc();

    await QueryExecutionRepository.log({
      attemptId: attempt.id,
      sqlText: query,
      status: timedOut ? "timeout" : failed ? "error" : "success",
      errorMessage: failed?.error?.message ?? null,
      rowCount: result.statements.reduce((n, s) => n + (s.rowCount ?? 0), 0),
      durationMs: result.executionTime,
      jobId,
    });

    return result;
  }
}
