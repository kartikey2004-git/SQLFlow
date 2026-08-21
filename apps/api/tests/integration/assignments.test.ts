import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { createTestAssignment, cleanupTestData } from "../helpers/fixtures";

const app = createApp();

describe("Assignments", () => {
  let assignmentId: number;

  beforeAll(async () => {
    const fixture = await createTestAssignment({
      solutionSql: "SELECT * FROM widgets WHERE price > 20",
      hiddenTestCase: true,
    });
    assignmentId = fixture.assignmentId;
  });

  afterAll(cleanupTestData);

  it("lists published assignments without exposing schema/solution details", async () => {
    const res = await request(app).get("/assignments");
    expect(res.status).toBe(200);
    const found = res.body.data.find((a: { id: number }) => a.id === assignmentId);
    expect(found).toBeDefined();
    expect(found.solution_sql).toBeUndefined();
    expect(found.sample_tables).toBeUndefined();
  });

  it("returns assignment detail with visible test cases but never solution_sql", async () => {
    const res = await request(app).get(`/assignments/${assignmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.solution_sql).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/price > 20/);
  });

  it("exposes hidden test cases only as {isHidden: true} with no expectedOutput", async () => {
    const res = await request(app).get(`/assignments/${assignmentId}`);
    const hidden = res.body.data.testCases.find((tc: { isHidden: boolean }) => tc.isHidden);
    expect(hidden).toBeDefined();
    expect(hidden.expectedOutput).toBeUndefined();

    const visible = res.body.data.testCases.find((tc: { isHidden: boolean }) => !tc.isHidden);
    expect(visible.expectedOutput).toBeDefined();
  });

  it("404s on a nonexistent assignment id", async () => {
    const res = await request(app).get("/assignments/999999999");
    expect(res.status).toBe(404);
  });

  it("400s on a non-numeric assignment id", async () => {
    const res = await request(app).get("/assignments/not-a-number");
    expect(res.status).toBe(400);
  });
});
