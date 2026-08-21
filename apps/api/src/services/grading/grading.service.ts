import { ExecutionService } from "../sandbox/execution.service";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { TestCaseRepository } from "../../repositories/testCase.repository";
import { SubmissionRepository } from "../../repositories/submission.repository";
import { EvaluationResultRepository } from "../../repositories/evaluationResult.repository";
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
  results: TestCaseGradingResult[];
}

export class GradingService {
  /**
   * Executes the student's query once, then evaluates it against every test
   * case for the assignment (visible + hidden). A submission + one
   * evaluation_result row per test case are persisted regardless of outcome.
   * Hidden test cases only ever surface pass/fail - never the expected rows
   * or a diff reason, so a failing student can't reverse-engineer the answer
   * from grading feedback.
   */
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

    // Creates the submission row, or - if `jobId` matches a row from an
    // earlier delivery of this same pg-boss job - returns that row instead
    // (see SubmissionRepository.create). A row already in a terminal state
    // means a *previous* delivery already finished grading it: this
    // delivery is a duplicate (e.g. redelivered after the worker's ack was
    // lost), so replay the stored result instead of re-executing/re-grading
    // and inserting a second set of evaluation_results.
    const submission = await SubmissionRepository.create({ attemptId: attempt.id, sqlText: query, jobId });
    if (submission.status === "completed" || submission.status === "failed") {
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

    // Execute once - every test case is graded against the same result set.
    const queryResult = await ExecutionService.executeQuery(userId, assignmentId, query, jobId);
    const normalizedActual = NormalizerService.normalizeQueryResult(queryResult);

    const results: TestCaseGradingResult[] = testCases.map((testCase) => {
      const normalizedExpected = NormalizerService.normalizeExpectedOutput({
        type: testCase.expected_output_type,
        value: testCase.expected_output,
      });
      const comparison = ComparatorService.compare(
        normalizedActual,
        normalizedExpected,
        testCase.expected_output_type,
      );

      return {
        testCaseId: testCase.id,
        isHidden: testCase.is_hidden,
        passed: comparison.passed,
        // Never leak a diff/reason for hidden test cases.
        reason: testCase.is_hidden ? null : comparison.reason,
      };
    });

    const totalWeight = testCases.reduce((sum, tc) => sum + Number(tc.weight), 0);
    const earnedWeight = testCases.reduce(
      (sum, tc, i) => sum + (results[i]!.passed ? Number(tc.weight) : 0),
      0,
    );
    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 10000) / 100 : 0;
    const passed = results.every((r) => r.passed);

    // Upsert, not insert: `submission` may be a row reused from a crashed
    // mid-grade retry (status was still "evaluating", not terminal, so the
    // early-return above didn't fire) that already has a partial set of
    // evaluation_results from the attempt that crashed.
    await EvaluationResultRepository.bulkUpsert(
      submission.id,
      results.map((r) => ({
        testCaseId: r.testCaseId,
        passed: r.passed,
        details: r.isHidden ? undefined : { reason: r.reason },
      })),
    );

    await SubmissionRepository.updateResult(submission.id, {
      status: "completed",
      passed,
      score,
      executionTimeMs: queryResult.executionTime,
      rowCount: queryResult.rowCount,
    });

    return {
      submissionId: submission.id,
      passed,
      score,
      executionTime: queryResult.executionTime,
      rowCount: queryResult.rowCount,
      results,
    };
  }
}
