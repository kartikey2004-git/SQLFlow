import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { createTestUser, createTestAssignment, cleanupTestData } from "../helpers/fixtures";

const app = createApp();

describe("Progress", () => {
  let assignmentId: number;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const { email, password } = await createTestUser();
    const fixture = await createTestAssignment();
    assignmentId = fixture.assignmentId;
    agent = request.agent(app);
    await agent.post("/auth/sign-in/email").send({ email, password });
  });

  afterAll(cleanupTestData);

  it("creates progress on first read", async () => {
    const res = await agent.get(`/progress/${assignmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.attemptCount).toBe(0);
    expect(res.body.data.isCompleted).toBe(false);
  });

  it("updates last query and increments attempt count", async () => {
    const res = await agent
      .put(`/progress/${assignmentId}`)
      .send({ lastQuery: "SELECT 1", incrementAttempt: true });
    expect(res.status).toBe(200);
    expect(res.body.data.lastQuery).toBe("SELECT 1");
    expect(res.body.data.attemptCount).toBe(1);
  });

  it("marks completed regardless of what the saved query text contains", async () => {
    // Regression test for the old bug: markCompleted was gated on
    // `!lastQuery.includes("completed")`, so a query mentioning that word
    // anywhere would silently fail to mark progress complete.
    const res = await agent
      .put(`/progress/${assignmentId}`)
      .send({ lastQuery: "SELECT 'completed' AS status", markCompleted: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isCompleted).toBe(true);
  });

  it("rejects access without authentication", async () => {
    const res = await request(app).get(`/progress/${assignmentId}`);
    expect(res.status).toBe(401);
  });

  it("only ever returns the caller's own progress, never another user's", async () => {
    const other = await createTestUser();
    const otherAgent = request.agent(app);
    await otherAgent.post("/auth/sign-in/email").send({ email: other.email, password: other.password });

    const res = await otherAgent.get(`/progress/${assignmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.attemptCount).toBe(0); // not the first user's incremented count
  });
});
