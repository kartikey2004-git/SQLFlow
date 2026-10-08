import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { pool } from "@sql-learn/database";
import { createTestUser, createTestAssignment, cleanupTestData } from "../helpers/fixtures";
import { GradingService } from "../../src/services/grading/grading.service";
import { SandboxService } from "../../src/services/sandbox/sandbox.service";
import { SubmissionRepository } from "../../src/repositories/submission.repository";
import { CleanupService } from "../../src/services/cleanup/cleanup.service";

describe("Queue idempotency and stale-submission reconciliation", () => {
  let userId: number;
  let assignmentId: number;

  beforeAll(async () => {
    const { user } = await createTestUser();
    userId = user.id;
    const fixture = await createTestAssignment({ solutionSql: "SELECT * FROM widgets WHERE price > 20" });
    assignmentId = fixture.assignmentId;
    await SandboxService.initSandbox(userId, assignmentId);
  });

  afterAll(cleanupTestData);

  it("a retried grading job (same job id) does not create a duplicate submission or duplicate evaluation_results", async () => {
    const jobId = randomUUID();

    const first = await GradingService.gradeSubmission(
      userId,
      assignmentId,
      "SELECT * FROM widgets WHERE price > 20",
      jobId,
    );

    const second = await GradingService.gradeSubmission(
      userId,
      assignmentId,
      "SELECT * FROM widgets WHERE price > 20",
      jobId,
    );

    expect(second.submissionId).toBe(first.submissionId);
    expect(second.passed).toBe(first.passed);
    expect(second.score).toBe(first.score);

    const submissions = await pool.query(`SELECT id FROM submissions WHERE job_id = $1`, [jobId]);
    expect(submissions.rows).toHaveLength(1);

    const results = await pool.query(`SELECT id FROM evaluation_results WHERE submission_id = $1`, [
      first.submissionId,
    ]);
    expect(results.rows.length).toBeGreaterThan(0);
    expect(results.rows.length).toBe(new Set(results.rows.map((r) => r.id)).size);
  });

  it("two different job ids each get their own submission (not deduped across jobs)", async () => {
    const jobIdA = randomUUID();
    const jobIdB = randomUUID();

    const a = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets", jobIdA);
    const b = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets", jobIdB);

    expect(a.submissionId).not.toBe(b.submissionId);
  });

  it("reconcileStaleSubmissions flips a submission stuck in evaluating past the threshold to failed", async () => {
    const submission = await SubmissionRepository.create({
      attemptId: (await pool.query(`SELECT id FROM attempts WHERE user_id = $1 AND assignment_id = $2`, [
        userId,
        assignmentId,
      ])).rows[0].id,
      sqlText: "SELECT 1",
    });
    await pool.query(`UPDATE submissions SET submitted_at = now() - interval '10 minutes' WHERE id = $1`, [
      submission.id,
    ]);

    const { reconciled } = await CleanupService.reconcileStaleSubmissions(5);
    expect(reconciled).toBeGreaterThanOrEqual(1);

    const updated = await SubmissionRepository.findById(submission.id);
    expect(updated!.status).toBe("failed");
    expect(updated!.error_message).toMatch(/stuck evaluating/i);
  });

  it("does not touch a submission still within the stale threshold", async () => {
    const attemptId = (
      await pool.query(`SELECT id FROM attempts WHERE user_id = $1 AND assignment_id = $2`, [
        userId,
        assignmentId,
      ])
    ).rows[0].id;
    const fresh = await SubmissionRepository.create({ attemptId, sqlText: "SELECT 1" });

    await CleanupService.reconcileStaleSubmissions(5);

    const stillEvaluating = await SubmissionRepository.findById(fresh.id);
    expect(stillEvaluating!.status).toBe("evaluating");
  });
});
