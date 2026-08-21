import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

const app = createApp();

describe("Cleanup endpoints (fail-closed authorization)", () => {
  it("rejects requests with no authorization header", async () => {
    const res = await request(app).get("/cleanup/stats");
    expect(res.status).toBe(403);
  });

  it("rejects requests with the wrong token", async () => {
    const res = await request(app).get("/cleanup/stats").set("x-cleanup-authorization", "wrong-token");
    expect(res.status).toBe(403);
  });

  it("rejects an empty-string token header (must not equal an empty CLEANUP_TOKEN)", async () => {
    const res = await request(app).get("/cleanup/stats").set("x-cleanup-authorization", "");
    expect(res.status).toBe(403);
  });

  it("accepts the correct token", async () => {
    const res = await request(app)
      .get("/cleanup/stats")
      .set("x-cleanup-authorization", process.env.CLEANUP_TOKEN!);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalProvisionedSandboxes");
  });
});
