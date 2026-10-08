import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { cleanupTestData } from "../helpers/fixtures";

const app = createApp();

afterAll(cleanupTestData);

describe("Auth flow", () => {
  const email = `test_auth_${Date.now()}@example.com`;
  const password = "password123";

  it("registers a new account and sets a session cookie", async () => {
    const res = await request(app)
      .post("/auth/sign-up/email")
      .send({ email, password, name: "New Student" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe("student");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/argon2/);
  });

  it("rejects duplicate registration", async () => {
    const res = await request(app)
      .post("/auth/sign-up/email")
      .send({ email, password, name: "Duplicate" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects a weak password", async () => {
    const res = await request(app)
      .post("/auth/sign-up/email")
      .send({ email: `weak_${Date.now()}@example.com`, password: "short", name: "X" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and can access /auth/get-session", async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post("/auth/sign-in/email").send({ email, password });
    expect(loginRes.status).toBe(200);

    const meRes = await agent.get("/auth/get-session");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email);
  });

  it("rejects an incorrect password", async () => {
    const res = await request(app).post("/auth/sign-in/email").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects a login for a nonexistent account with the same status as a wrong password", async () => {
    const res = await request(app)
      .post("/auth/sign-in/email")
      .send({ email: "nobody-at-all@example.com", password: "whatever123" });
    expect(res.status).toBe(401);
  });

  it("returns an empty session for unauthenticated /auth/get-session", async () => {
    const res = await request(app).get("/auth/get-session");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("rejects unauthenticated access to a protected route", async () => {
    const res = await request(app).get("/progress");
    expect(res.status).toBe(401);
  });

  it("logout invalidates the session", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/sign-in/email").send({ email, password });
    expect((await agent.get("/auth/get-session")).body).not.toBeNull();

    await agent.post("/auth/sign-out");
    expect((await agent.get("/auth/get-session")).body).toBeNull();
  });
});
