import type { StatementResult, QueryResult } from "@sql-learn/types";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { TestCaseRepository } from "../../repositories/testCase.repository";
import { SubmissionRepository } from "../../repositories/submission.repository";
import { EvaluationResultRepository } from "../../repositories/evaluationResult.repository";
import { QueryExecutionRepository } from "../../repositories/queryExecution.repository";
import { SandboxService } from "../sandbox/sandbox.service";
import { withStudentConnection } from "../sandbox/execution.service";
import { runScript } from "../sandbox/scriptRunner";
import type { TableResult } from "../sandbox/tableResult";
import { NormalizerService } from "./normalizer.service";
import { ComparatorService } from "./comparator.service";
import { ApiError } from "../../utils/ApiError";

export interface TestCaseGradingResult {
  testCaseId: number;
  isHidden: boolean;
  passed: boolean;
  reason?: string | null;
}

export interface GradingResult {
  submissionId: number;
  passed: boolean;
  score: number;
  executionTime: number;
  rowCount: number;
  statements?: StatementResult[];
  results: TestCaseGradingResult[];
}

function lastTable(result: QueryResult): TableResult {
  const withRows = [...result.statements].reverse().find((s) => s.columns.length > 0 && !s.error);
  return {
    columns: withRows?.columns ?? [],
    rows: withRows?.rows ?? [],
    rowCount: withRows?.rows.length ?? 0,
    executionTime: result.executionTime,
  };
}

const VALIDATION_PREAMBLE = "SET search_path = pg_catalog, public;";

export class GradingService {
  static async gradeSubmission(
    userId: number,
    assignmentId: number,
    query: string,
    jobId?: string,
  ): Promise<GradingResult> {
    const attempt = await AttemptRepository.findByUserAndAssignment(userId, assignmentId);
    if (!attempt) {
      throw new ApiError(404, "Sandbox not found for this assignment. Please initialize the sandbox first.");
    }

    const testCases = await TestCaseRepository.findByAssignmentId(assignmentId);
    if (testCases.length === 0) {
      throw new ApiError(500, "This assignment has no test cases configured");
    }

    const submission = await SubmissionRepository.create({ attemptId: attempt.id, sqlText: query, jobId });
    if (submission.status === "completed") {
      const testCaseById = new Map(testCases.map((tc) => [tc.id, tc]));
      const storedResults = await EvaluationResultRepository.findBySubmissionId(submission.id);
      return {
        submissionId: submission.id,
        passed: submission.passed ?? false,
        score: submission.score ? Number(submission.score) : 0,
        executionTime: submission.execution_time_ms ?? 0,
        rowCount: submission.row_count ?? 0,
        results: storedResults.map((r) => ({
          testCaseId: r.test_case_id,
          isHidden: testCaseById.get(r.test_case_id)?.is_hidden ?? true,
          passed: r.passed,
          reason: (r.details as { reason?: string | null } | null)?.reason ?? null,
        })),
      };
    }
    if (submission.status === "failed" || submission.status === "cancelled") {
      await SubmissionRepository.updateResult(submission.id, { status: "evaluating" });
    }

    try {
      return await this.evaluate(userId, assignmentId, attempt.id, submission.id, query, testCases, jobId);
    } catch (error) {
      await SubmissionRepository.updateResult(submission.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Grading failed",
      }).catch(() => {});
      throw error;
    } finally {
      await SandboxService.destroyGradingDb(submission.id).catch(() => {});
    }
  }

  private static async evaluate(
    userId: number,
    assignmentId: number,
    attemptId: number,
    submissionId: number,
    query: string,
    testCases: Awaited<ReturnType<typeof TestCaseRepository.findByAssignmentId>>,
    jobId?: string,
  ): Promise<GradingResult> {
    const { db, role } = await SandboxService.createGradingDb(submissionId, assignmentId);

    const run = await withStudentConnection(role, db, (client, deadline) => runScript(client, query, deadline));
    const failure = run.statements.find((s) => s.error);

    await QueryExecutionRepository.log({
      attemptId,
      sqlText: query,
      status: failure ? (failure.error!.code === "57014" ? "timeout" : "error") : "success",
      errorMessage: failure?.error?.message ?? null,
      rowCount: run.statements.reduce((n, s) => n + (s.rowCount ?? 0), 0),
      durationMs: run.executionTime,
      jobId,
    });

    const results: TestCaseGradingResult[] = [];
    for (const testCase of testCases) {
      let passed = false;
      let reason: string | null = null;

      if (failure) {
        reason = `Your script failed: ${failure.error!.message}`;
      } else {
        let actual: TableResult;
        if (testCase.validation_sql) {
          const validation = await withStudentConnection(role, db, (client, deadline) =>
            runScript(client, `${VALIDATION_PREAMBLE} ${testCase.validation_sql}`, deadline),
          );
          const vFail = validation.statements.find((s) => s.error);
          actual = vFail
            ? { columns: [], rows: [], rowCount: 0, executionTime: validation.executionTime }
            : lastTable(validation);
          if (vFail) reason = "Could not verify the resulting database state";
        } else {
          actual = lastTable(run);
        }

        if (reason === null) {
          const normalizedActual = NormalizerService.normalizeQueryResult(actual);
          const normalizedExpected = NormalizerService.normalizeExpectedOutput({
            type: testCase.expected_output_type,
            value: testCase.expected_output,
          });
          const comparison = ComparatorService.compare(normalizedActual, normalizedExpected, testCase.expected_output_type);
          passed = comparison.passed;
          reason = comparison.reason ?? null;
        }
      }

      results.push({
        testCaseId: testCase.id,
        isHidden: testCase.is_hidden,
        passed,
        reason: testCase.is_hidden ? null : reason,
      });
    }

    const totalWeight = testCases.reduce((sum, tc) => sum + Number(tc.weight), 0);
    const earnedWeight = testCases.reduce((sum, tc, i) => sum + (results[i]!.passed ? Number(tc.weight) : 0), 0);
    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 10000) / 100 : 0;
    const passed = results.every((r) => r.passed);

    await EvaluationResultRepository.bulkUpsert(
      submissionId,
      results.map((r) => ({
        testCaseId: r.testCaseId,
        passed: r.passed,
        details: r.isHidden ? undefined : { reason: r.reason },
      })),
    );

    const rowCount = lastTable(run).rowCount;
    await SubmissionRepository.updateResult(submissionId, {
      status: "completed",
      passed,
      score,
      executionTimeMs: run.executionTime,
      rowCount,
    });

    if (passed) {
      await AttemptRepository.update(userId, assignmentId, { markCompleted: true });
    }

    return { submissionId, passed, score, executionTime: run.executionTime, rowCount, statements: run.statements, results };
  }
}
