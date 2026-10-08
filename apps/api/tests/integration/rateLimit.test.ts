import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

const app = createApp();

describe("Login rate limiting", () => {
  it("locks out after repeated failed attempts from the same IP+email", async () => {
    const email = "brute-force-target@example.com";
    const attempts = Array.from({ length: 10 }, () =>
      request(app).post("/auth/sign-in/email").send({ email, password: "wrong-password" }),
    );

    const responses = [];
    for (const attempt of attempts) {
      responses.push(await attempt);
    }

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses.slice(-2)).toEqual([429, 429]);
  });
});
