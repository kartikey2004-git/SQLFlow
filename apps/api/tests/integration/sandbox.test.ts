import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { createTestUser, createTestAssignment, cleanupTestData } from "../helpers/fixtures";
import { ExecutionService, ExecutionServiceError } from "../../src/services/sandbox/execution.service";
import { GradingService } from "../../src/services/grading/grading.service";
import { pool } from "@sql-learn/database";

const app = createApp();

describe("Sandbox lifecycle", () => {
  let userId: number;
  let assignmentId: number;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const { user, email, password } = await createTestUser();
    userId = user.id;
    const fixture = await createTestAssignment({ solutionSql: "SELECT * FROM widgets WHERE price > 20" });
    assignmentId = fixture.assignmentId;

    agent = request.agent(app);
    await agent.post("/auth/sign-in/email").send({ email, password });
  });

  afterAll(cleanupTestData);

  it("provisions a sandbox schema on init", async () => {
    const res = await agent.post("/sandbox/init").send({ assignmentId });
    expect(res.status).toBe(200);
    expect(res.body.data.isNew).toBe(true);
    expect(res.body.data.schemaName).toMatch(new RegExp(`sb_u${userId}_a${assignmentId}`));
  });

  it("is idempotent - re-init returns the same schema without recreating it", async () => {
    const res = await agent.post("/sandbox/init").send({ assignmentId });
    expect(res.status).toBe(200);
    expect(res.body.data.isNew).toBe(false);
  });

  it("queues a query execution job and returns 202 with a jobId (async contract)", async () => {
    const res = await agent
      .post("/sandbox/execute")
      .send({ assignmentId, query: "SELECT * FROM widgets" });
    expect(res.status).toBe(202);
    expect(res.body.data.jobId).toBeDefined();
  });

  it("runs the actual query via ExecutionService against the real sandbox schema", async () => {
    const result = await ExecutionService.executeQuery(userId, assignmentId, "SELECT * FROM widgets WHERE price > 20");
    expect(result.rowCount).toBe(2);
    expect(result.rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ price: 25 }), expect.objectContaining({ price: 40 })]),
    );
  });

  it("rejects a non-SELECT query before it ever reaches Postgres", async () => {
    await expect(ExecutionService.executeQuery(userId, assignmentId, "DROP TABLE widgets")).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });

    // Prove it never reached the DB: the table must still exist and be queryable.
    const stillThere = await ExecutionService.executeQuery(userId, assignmentId, "SELECT * FROM widgets");
    expect(stillThere.rowCount).toBe(3);
  });

  it("grades a correct submission as passed", async () => {
    const result = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets WHERE price > 20");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("grades an incorrect submission as failed with a reason", async () => {
    const result = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets");
    expect(result.passed).toBe(false);
    expect(result.results[0]!.reason).toBeTruthy();
  });

  it("throws SANDBOX_NOT_FOUND for a user who never initialized a sandbox", async () => {
    const { user: otherUser } = await createTestUser();
    await expect(
      ExecutionService.executeQuery(otherUser.id, assignmentId, "SELECT 1"),
    ).rejects.toBeInstanceOf(ExecutionServiceError);
  });

  it("persists query_executions and submissions rows for auditability", async () => {
    const attempt = await pool.query(
      `SELECT id FROM attempts WHERE user_id = $1 AND assignment_id = $2`,
      [userId, assignmentId],
    );
    const attemptId = attempt.rows[0].id;

    const executions = await pool.query(`SELECT * FROM query_executions WHERE attempt_id = $1`, [attemptId]);
    expect(executions.rows.length).toBeGreaterThan(0);

    const submissions = await pool.query(`SELECT * FROM submissions WHERE attempt_id = $1`, [attemptId]);
    expect(submissions.rows.length).toBeGreaterThan(0);
  });
});
