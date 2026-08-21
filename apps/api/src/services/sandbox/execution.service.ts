import { sandboxPool } from "@sql-learn/database";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { QueryExecutionRepository } from "../../repositories/queryExecution.repository";
import { ValidationService } from "./validation.service";
import { SandboxService } from "./sandbox.service";
import { queryExecutionDuration, queryTimeoutTotal } from "../../utils/metrics";

export interface QueryResult {
  columns: string[];
  rows: object[];
  rowCount: number;
  executionTime: number;
}

export type ExecutionErrorType =
  | "SANDBOX_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "TIMEOUT"
  | "SYNTAX_ERROR"
  | "RUNTIME_ERROR"
  | "PERMISSION_ERROR";

export class ExecutionServiceError extends Error {
  constructor(
    public readonly type: ExecutionErrorType,
    message: string,
  ) {
    super(message);
  }
}

// Per-transaction override, on top of the sandbox_runner role's own baked-in
// defaults (see migrations/1700000000002_sandbox_runner_role.cjs) - belt and
// suspenders in case the role-level default ever changes.
const STATEMENT_TIMEOUT_MS = 3000;
const ROW_CAP = 1000;

export class ExecutionService {
  static formatResult(pgResult: { fields?: { name: string }[]; rows?: object[]; rowCount?: number | null }, executionTime: number): QueryResult {
    return {
      columns: pgResult.fields?.map((field) => field.name) ?? [],
      rows: pgResult.rows ?? [],
      rowCount: pgResult.rowCount ?? 0,
      executionTime,
    };
  }

  /**
   * Classifies a Postgres error as a known "the student's query did this"
   * case (wrapped as a non-retryable ExecutionServiceError, reported to the
   * student), or rethrows the original error unwrapped when it isn't
   * recognized as the student's fault - e.g. a dropped connection (SQLSTATE
   * class 08), resource exhaustion (53), serialization/deadlock (40), an
   * admin/crash shutdown (57P0x, as opposed to the deliberate 57014
   * statement_timeout), or a bare JS error with no SQLSTATE at all (network
   * failure). worker.ts's catch-all rethrows those as unexpected failures,
   * which pg-boss retries - see prompt.md §14 ("retryable: temporary DB
   * failure / connection failure ... not retryable: SQL syntax error /
   * forbidden query"). The previous version of this defaulted *every*
   * unrecognized error to non-retryable, silently swallowing real
   * infrastructure failures as "your query failed."
   */
  static convertPostgresError(error: { code?: string; message?: string }): ExecutionServiceError {
    const code = error.code;
    const message = error.message || "Unknown database error";

    if (code === "57014") {
      return new ExecutionServiceError(
        "TIMEOUT",
        `Query execution exceeded the time limit (${STATEMENT_TIMEOUT_MS / 1000} seconds)`,
      );
    }
    if (code === "42601" || message.includes("syntax error")) {
      return new ExecutionServiceError("SYNTAX_ERROR", "Please check your SQL syntax and try again");
    }
    if (code === "42703" || (message.includes("column") && message.includes("does not exist"))) {
      return new ExecutionServiceError("RUNTIME_ERROR", "One or more columns in your query do not exist");
    }
    if (code === "42P01" || (message.includes("relation") && message.includes("does not exist"))) {
      return new ExecutionServiceError("RUNTIME_ERROR", "One or more tables in your query do not exist");
    }
    if (code === "42501" || message.includes("permission")) {
      return new ExecutionServiceError("PERMISSION_ERROR", "You do not have permission to perform this operation");
    }

    const RETRYABLE_SQLSTATE_CLASSES = ["08", "53", "40"]; // connection exception, insufficient resources, transaction rollback
    const RETRYABLE_SPECIFIC_CODES = new Set(["57P01", "57P02", "57P03"]); // admin/crash shutdown, cannot connect now
    if (!code || RETRYABLE_SQLSTATE_CLASSES.some((cls) => code.startsWith(cls)) || RETRYABLE_SPECIFIC_CODES.has(code)) {
      throw error;
    }

    return new ExecutionServiceError("RUNTIME_ERROR", message);
  }

  /**
   * Runs a validated, read-only student query against their sandbox schema.
   * Every execution: (1) passes AST validation, (2) runs as the low-privilege
   * `sandbox_runner` role inside its own transaction with a hard statement
   * timeout, (3) is wrapped to cap returned rows, (4) is logged. On any error
   * the connection is destroyed rather than returned to the pool - it may be
   * left in a weird state (e.g. mid-cancel), and per-student isolation
   * matters more here than connection reuse.
   */
  static async executeQuery(
    userId: number,
    assignmentId: number,
    query: string,
    jobId?: string,
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const attempt = await AttemptRepository.findByUserAndAssignment(userId, assignmentId);
    if (!attempt || !attempt.schema_name) {
      throw new ExecutionServiceError(
        "SANDBOX_NOT_FOUND",
        "Sandbox not found for this assignment. Please initialize the sandbox first.",
      );
    }
    const schemaName = attempt.schema_name;

    const validation = await ValidationService.validate(query);
    if (!validation.isValid) {
      await QueryExecutionRepository.log({
        attemptId: attempt.id,
        sqlText: query,
        status: "error",
        errorMessage: validation.error,
        durationMs: Date.now() - startTime,
        jobId,
      });
      throw new ExecutionServiceError("VALIDATION_ERROR", validation.error ?? "Invalid query");
    }

    const trimmedQuery = query.trim().replace(/;\s*$/, "");
    const wrappedQuery = `SELECT * FROM (${trimmedQuery}) AS _sandbox_result LIMIT ${ROW_CAP}`;

    const client = await sandboxPool.connect();
    let destroyConnection = false;
    try {
      await client.query("BEGIN");
      // Activates *only* this user's per-user role for this transaction
      // (sandbox_runner is a member of it WITH INHERIT FALSE - see
      // SandboxService.ensureUserRole) - the DB-level backstop behind the
      // AST validator's schema-qualification check. A schema-qualified
      // reference to another student's schema now fails with "permission
      // denied for schema ..." even if the AST layer somehow let it through,
      // because sandbox_runner's own privilege set never includes it and
      // this SET ROLE never activates any *other* student's role.
      await client.query(`SET LOCAL ROLE "${SandboxService.sandboxUserRole(userId)}"`);
      await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      // schemaName is sanitized to [a-zA-Z0-9_] by SandboxService - safe to interpolate as an identifier.
      await client.query(`SET LOCAL search_path TO "${schemaName}"`);

      const result = await client.query(wrappedQuery);
      await client.query("COMMIT");

      const executionTime = Date.now() - startTime;
      queryExecutionDuration.observe({ status: "success" }, executionTime / 1000);

      await QueryExecutionRepository.log({
        attemptId: attempt.id,
        sqlText: query,
        status: "success",
        rowCount: result.rowCount ?? 0,
        durationMs: executionTime,
        jobId,
      });

      return this.formatResult(result, executionTime);
    } catch (error) {
      destroyConnection = true;
      try {
        await client.query("ROLLBACK");
      } catch {
        // Connection is already broken (e.g. after a cancel) - nothing more to do.
      }

      const executionTime = Date.now() - startTime;

      let execError: ExecutionServiceError;
      try {
        execError =
          error instanceof ExecutionServiceError
            ? error
            : this.convertPostgresError(error as { code?: string; message?: string });
      } catch (unclassified) {
        // convertPostgresError rethrew: this wasn't recognized as the
        // student's fault (e.g. a dropped connection). Log it as an error
        // for observability, then propagate the *original* error unwrapped
        // so worker.ts's catch-all treats the job as an unexpected failure
        // and lets pg-boss retry it, instead of reporting "your query
        // failed" to the student for what was actually an infra hiccup.
        await QueryExecutionRepository.log({
          attemptId: attempt.id,
          sqlText: query,
          status: "error",
          errorMessage: "Transient infrastructure error - retrying",
          durationMs: executionTime,
          jobId,
        });
        throw unclassified;
      }

      queryExecutionDuration.observe(
        { status: execError.type === "TIMEOUT" ? "timeout" : "error" },
        executionTime / 1000,
      );
      if (execError.type === "TIMEOUT") {
        queryTimeoutTotal.inc();
      }

      await QueryExecutionRepository.log({
        attemptId: attempt.id,
        sqlText: query,
        status: execError.type === "TIMEOUT" ? "timeout" : "error",
        errorMessage: execError.message,
        durationMs: executionTime,
        jobId,
      });

      throw execError;
    } finally {
      client.release(destroyConnection);
    }
  }
}
