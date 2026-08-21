import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { createTestUser, createTestAssignment, cleanupTestData } from "../helpers/fixtures";

const app = createApp();

describe("Hints", () => {
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

  it("returns a clean 'not configured' response when GOOGLE_GENERATIVE_AI_API_KEY is unset", async () => {
    // Don't trust the ambient environment to have this unset - some dev
    // machines have a real key exported globally for unrelated tools.
    const original = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    try {
      const res = await agent.post("/hints").send({ assignmentId, userQuery: "SELECT * FROM widgets" });
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
    } finally {
      if (original !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = original;
    }
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/hints").send({ assignmentId, userQuery: "x" });
    expect(res.status).toBe(401);
  });
});
